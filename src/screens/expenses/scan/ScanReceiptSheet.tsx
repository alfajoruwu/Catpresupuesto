import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Camera, Image } from 'lucide-react';
import { preloadOcr, scanReceipt } from '../../../ocr';
import type { ReceiptData, ScanStage } from '../../../ocr';
import { api } from '../../../api/client';
import { invalidate, useQuery } from '../../../lib/data';
import { todayISO } from '../../../lib/dates';
import { formatMoney } from '../../../lib/format';
import {
  Button,
  DateField,
  MoneyField,
  SelectField,
  Sheet,
  TextField,
  toast,
} from '../../../ui';
import { CameraCapture } from './CameraCapture';
import './scan.css';

type ScanState = 'pick' | 'camera' | 'scanning' | 'review' | 'error';

const STAGES: { id: ScanStage; label: string }[] = [
  { id: 'preparing', label: 'Preparando imagen' },
  { id: 'barcode', label: 'Buscando código de la boleta' },
  { id: 'loading-model', label: 'Cargando modelo de lectura' },
  { id: 'ocr', label: 'Leyendo texto' },
  { id: 'parsing', label: 'Interpretando datos' },
];

const SOURCE_LABEL: Record<ReceiptData['source'], string> = {
  barcode: 'Leído desde: código de la boleta',
  ocr: 'Leído desde: texto de la foto',
  'barcode+ocr': 'Leído desde: código y texto',
};

export function ScanReceiptSheet(props: { open: boolean; onClose(): void }): ReactNode {
  const { open, onClose } = props;
  const [state, setState] = useState<ScanState>('pick');
  const [stage, setStage] = useState<ScanStage>('preparing');
  const [preview, setPreview] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [scanError, setScanError] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);
  const previewRef = useRef<string | null>(null);

  const catsQuery = useQuery(
    () =>
      open
        ? api.listCategories({ kind: 'expense', includeArchived: false })
        : Promise.resolve([]),
    [open],
  );
  const acctsQuery = useQuery(
    () => (open ? api.listAccounts({ includeArchived: false }) : Promise.resolve([])),
    [open],
  );
  const categories = catsQuery.data ?? [];
  const accounts = acctsQuery.data ?? [];
  const setupLoading = catsQuery.loading || acctsQuery.loading;
  const missingSetup = !setupLoading && (categories.length === 0 || accounts.length === 0);

  useEffect(() => {
    if (open) {
      preloadOcr().catch(() => {});
    }
  }, [open ]);

  useEffect(() => {
    const list = acctsQuery.data;
    if (state === 'review' && accountId === null && list !== undefined && list.length === 1) {
      setAccountId(list[0].id);
    }
  }, [state, accountId, acctsQuery.data]);

  function setPreviewUrl(url: string | null): void {
    if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }

  function resetToPick(): void {
    seqRef.current += 1;
    setPreviewUrl(null);
    setReceipt(null);
    setScanError('');
    setAmount(0);
    setDate(todayISO());
    setDescription('');
    setCategoryId(null);
    setAccountId(null);
    setSaving(false);
    setStage('preparing');
    setState('pick');
  }

  function handleClose(): void {
    resetToPick();
    onClose();
  }

  async function startScan(file: File): Promise<void> {
    const id = ++seqRef.current;
    setPreviewUrl(URL.createObjectURL(file));
    setStage('preparing');
    setState('scanning');
    try {
      const data = await scanReceipt(file, {
        today: todayISO(),
        onStage: (s) => {
          if (seqRef.current === id) setStage(s);
        },
      });
      if (seqRef.current !== id) return;
      setReceipt(data);
      setAmount(data.total ?? 0);
      setDate(data.date ?? todayISO());
      setDescription(data.merchant ?? '');
      setState('review');
    } catch (e: unknown) {
      if (seqRef.current !== id) return;
      setScanError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file !== undefined) void startScan(file);
  }

  function openCamera(): void {
    // Sin getUserMedia (p. ej. escritorio), se usa el selector de archivos con captura.
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') setState('camera');
    else cameraRef.current?.click();
  }

  function showCameraError(message: string): void {
    setScanError(message);
    setState('error');
  }

  async function handleSave(): Promise<void> {
    if (receipt === null) return;
    if (amount <= 0) {
      toast('Ingresa un monto mayor a 0', 'error');
      return;
    }
    if (categoryId === null) {
      toast('Elige una categoría', 'error');
      return;
    }
    if (accountId === null) {
      toast('Elige una cuenta', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createExpense({
        amount,
        date,
        categoryId,
        accountId,
        description,
        receipt: {
          merchant: receipt.merchant,
          taxId: receipt.taxId,
          docType: receipt.docType,
          folio: receipt.folio,
        },
      });
      invalidate();
      toast('Gasto guardado', 'ok');
      resetToPick();
      onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : String(e), 'error');
      setSaving(false);
    }
  }

  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.id === stage));

  return (
    <Sheet
      open={open}
      title="Escanear boleta"
      onClose={handleClose}
      footer={
        state === 'review' ? (
          <div className="scan-footer">
            <Button block loading={saving} onClick={() => void handleSave()}>
              Guardar gasto
            </Button>
            <Button block variant="ghost" onClick={resetToPick}>
              Usar otra foto
            </Button>
          </div>
        ) : undefined
      }
    >
      {state === 'pick' ? (
        <div className="scan-pick">
          <Button block onClick={openCamera}>
            <Camera size={20} />
            Tomar foto
          </Button>
          <Button block variant="secondary" onClick={() => galleryRef.current?.click()}>
            <Image size={20} />
            Elegir de la galería
          </Button>
          <p className="scan-hint">
            Encuadra la boleta completa, con buena luz. Si tiene código (timbre o QR), inclúyelo.
          </p>
        </div>
      ) : null}
      {state === 'camera' ? (
        <CameraCapture
          onCapture={(file) => void startScan(file)}
          onCancel={resetToPick}
          onError={showCameraError}
        />
      ) : null}
      {state === 'scanning' ? (
        <div className="scan-scanning">
          {preview !== null ? (
            <img className="scan-preview" src={preview} alt="Foto de la boleta" />
          ) : null}
          <p className="scan-stage">{STAGES[stageIndex].label}</p>
          <p className="scan-hint">
            Paso {stageIndex + 1} de {STAGES.length}
          </p>
          <div className="scan-segments" aria-hidden="true">
            {STAGES.map((s, i) => (
              <span key={s.id} className={i <= stageIndex ? 'scan-seg is-done' : 'scan-seg'} />
            ))}
          </div>
        </div>
      ) : null}
      {state === 'review' && receipt !== null ? (
        <div className="scan-form">
          <MoneyField label="Monto" value={amount} onChange={setAmount} />
          {receipt.total === null ? (
            <p className="scan-hint">No detectado, ingrésalo a mano.</p>
          ) : null}
          <DateField label="Fecha" value={date} onChange={setDate} />
          {receipt.date === null ? (
            <p className="scan-hint">No detectado, ingrésalo a mano.</p>
          ) : null}
          <TextField label="Descripción" value={description} onChange={setDescription} />
          {missingSetup ? (
            <p className="scan-hint">Necesitas al menos una categoría de gastos y una cuenta.</p>
          ) : (
            <>
              <SelectField
                label="Categoría"
                value={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(v) => setCategoryId(v)}
              />
              <SelectField
                label="Pagado desde"
                value={accountId}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} · ${formatMoney(a.balance)}`,
                }))}
                onChange={(v) => setAccountId(v)}
              />
            </>
          )}
          {receipt.docType !== null ? (
            <div className="scan-row">
              <span>Documento</span>
              <span>{receipt.docType}</span>
            </div>
          ) : null}
          {receipt.folio !== null ? (
            <div className="scan-row">
              <span>Folio</span>
              <span>{receipt.folio}</span>
            </div>
          ) : null}
          {receipt.taxId !== null ? (
            <div className="scan-row">
              <span>RUT emisor</span>
              <span>{receipt.taxId}</span>
            </div>
          ) : null}
          <p className="scan-source">{SOURCE_LABEL[receipt.source]}</p>
          {receipt.rawText !== '' ? (
            <details className="scan-raw">
              <summary>Texto leído</summary>
              <pre>{receipt.rawText}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="scan-error">
          <p className="scan-error__message">{scanError}</p>
          <Button block onClick={resetToPick}>
            Usar otra foto
          </Button>
          <Button block variant="ghost" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      ) : null}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="scan-file"
        onChange={handleFile}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="scan-file"
        onChange={handleFile}
      />
    </Sheet>
  );
}
