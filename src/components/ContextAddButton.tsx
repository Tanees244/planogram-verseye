"use client";

import {
  usePlanogramStore,
  type Rack,
  type RackSide,
  type Row,
  type Bin,
} from "@/store/planogramStore";
import { useState, useEffect, useCallback } from "react";

interface Location {
  id: string;
  locationCode: string;
  isActive: boolean;
  isArchived: boolean;
}
import { Button } from "@verseye/ui";
import { FiTrash2, FiSave, FiRotateCcw, FiRotateCw, FiShare2, FiGitMerge, FiCopy, FiClipboard, FiCamera, FiCheckCircle } from "react-icons/fi";
import { getPlanogramTokenFromCookie } from "@verseye/utils";
import { resolveProductFacingId } from "@/utils/storeLayoutLoader";
import { BinInventoryPanel } from "./BinInventoryPanel";
import { toastApiError } from "@/utils/apiMessages";
import toast from "react-hot-toast";
import { Spinner } from "./Spinner";
import { AddRackModal, type RackFormState } from '@/components/forms/AddRackModal'
import { AddRowModal } from '@/components/forms/AddRowModal'
import { SaveAsPlanogramModal } from '@/components/forms/SaveAsPlanogramModal'
import { ActionBar, ActionBtn } from '@/components/ui/ActionBar'
import { RackRowHeightsPanel, RowDimensionsField } from '@/components/RowHeightsEditor'
import { RackPosmPanel } from '@/components/RackPosmPanel'
import { RackSideZonesPanel } from '@/components/RackSideZonesPanel'
import { RowDividerPosmPanel } from '@/components/RowDividerPosmPanel'
import { RowFaceFillChip } from '@/components/RowFaceFillChip'
import { ShelfUtilizationMeter } from '@/components/ShelfUtilizationMeter'
import { RackPublishModal } from '@/components/RackPublishModal'
import { ComplianceChecklist } from '@/components/ComplianceChecklist'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Btn } from '@/components/ui/form'
import { MultiRackReflowModal } from '@/components/MultiRackReflowModal'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'
import { resolveFixtureType } from '@/components/fixtures/types'
import { validateRackForm, defaultRackForm } from '@/utils/rackFormUtils'
import {
  DEFAULT_RACK_DEPTH,
  DEFAULT_RACK_WIDTH,
  GROCERY_SHELF_SPACING,
} from '@/constants/dimensions'
import { maxBinDepthM } from '@/utils/rackBlueprintMapper'
import { cn } from '@/lib/cn'
import { displayRackName } from '@/utils/displayRackName'
import { cmInputFromM } from '@/utils/lengthUnits'
export function ContextAddButton({
  layout = 'horizontal',
  hidePosmPanel = false,
}: {
  layout?: 'horizontal' | 'sidebar'
  /** When true, rack / row POSM is shown in the POSM library tab instead. */
  hidePosmPanel?: boolean
}) {
  const isSidebar = layout === 'sidebar';
  const {
    selectedId,
    selectedType,
    addRack,
    addRackToServer,
    addRow,
    addRowToServer,
    addBin,
    addBinToServer,
    area,
    setPendingRackParams,
    setIsPlacingRack,
    addRackError,
    setAddRackError,
    isAddingRack,
    setEditingRackId,
    editingRackId,
    moveRackError,
    setMoveRackError,

    deleteRack,
    deleteRackFromServer,
    deleteRowFromServer,
    deleteBinFromServer,
    deleteProduct,
    addProduct,
    openCustomRackBuilder,
    customRackBuilderOpen,
    setSelected,
    saveRackLayoutToServer,
    isSavingLayout,
    saveLayoutError,
    rotateRack,
    setRackRotationY,
    setPendingBinPreview,
    copySelection,
    pasteClipboard,
    clipboard,
  } = usePlanogramStore();

  const [showRackModal, setShowRackModal] = useState(false);
  const [showRowModal, setShowRowModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Per-action loading states for addition buttons
  const [addingRow, setAddingRow] = useState(false);
  const [addingBin, setAddingBin] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showMultiReflowModal, setShowMultiReflowModal] = useState(false);
  const [showSavePlanogramModal, setShowSavePlanogramModal] = useState(false);
  const [confirmDeleteRack, setConfirmDeleteRack] = useState(false);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(false);
  const [confirmDetachProduct, setConfirmDetachProduct] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Add Bin modal state
  const [showBinModal, setShowBinModal] = useState(false);
  const [binNameError, setBinNameError] = useState<string | null>(null);

  // Clear ghost when modal closes
  useEffect(() => {
    if (!showBinModal) setPendingBinPreview(null)
  }, [showBinModal, setPendingBinPreview])

  // Location state for the Add Rack form
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState(
    () => usePlanogramStore.getState().selectedStoreId ?? ""
  );
  const [locationValidationError, setLocationValidationError] = useState<string | null>(null);

  // Fetch locations from SSR route when the Add Rack modal opens
  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true);
    setLocationsError(null);
    try {
      const headers: Record<string, string> = {};
      try {
        const t = getPlanogramTokenFromCookie();
        if (t) headers["Authorization"] = `Bearer ${t}`;
      } catch {
        // ignore cookie access errors in sandboxed environments
      }
      const res = await fetch("/api/locations/list", { headers });
      const data = await res.json();
      if (data.isRequestSuccess && data.data?.locations) {
        setLocations(data.data.locations);
      } else {
        setLocationsError(data.message || "Failed to load locations");
      }
    } catch {
      setLocationsError("Could not connect to server. Please try again.");
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showRackModal) {
      setLocationValidationError(null);
      // enforce required fields on open
      const initialErrors = validateRackForm("", rackForm);
      setRackErrors(initialErrors);
      setIsRackFormValid(Object.keys(initialErrors).length === 0);
      fetchLocations();
    }
  }, [showRackModal, fetchLocations]);

  // Bin inventory panel is shown when a bin is selected; attach via the action button.
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  const [rackForm, setRackForm] = useState<RackFormState>(defaultRackForm);
  const [rackErrors, setRackErrors] = useState<Record<string, string | null>>({});
  const [isRackFormValid, setIsRackFormValid] = useState(false);

  const [rowForm, setRowForm] = useState({
    height: cmInputFromM(GROCERY_SHELF_SPACING),
    count: '1',
  });

  const { attachProductToBin } = usePlanogramStore();

  const handleAttachProductSuccess = async (product: any, quantity: number) => {
    if (!selectedId) return;
    const result = await attachProductToBin(selectedId, product, quantity);
    if (!result.success) {
      toastApiError(result.message);
      return;
    }
    toast.success(result.message ?? 'Product attached');
    setInventoryRefreshKey((k) => k + 1);
  };

  if (!selectedId || !selectedType) return null;

  // In 3D view, fixtures are added via the left palette; hide generic area bar.
  if (selectedType === "area") return null;

  // Hide context bar while custom rack builder is open.
  if (customRackBuilderOpen) return null;

  const submitRack = async (position?: { x: number; y: number; z: number }) => {
    const errs = validateRackForm(selectedLocationId, rackForm)
    setRackErrors(errs)
    setIsRackFormValid(Object.keys(errs).length === 0)
    if (Object.keys(errs).length > 0) {
      setLocationValidationError(errs.location ?? null)
      return false
    }
    const w = (parseFloat(rackForm.width) || 0) / 100
    const d = (parseFloat(rackForm.depth) || 0) / 100
    const res = await addRackToServer(
      position,
      {
        width: w || DEFAULT_RACK_WIDTH,
        depth: d || DEFAULT_RACK_DEPTH,
        rackName: rackForm.rackName,
        plankType: rackForm.plankType,
        sided: rackForm.fixtureType === 'GONDOLA' ? rackForm.sided : 'one',
        fixtureType: rackForm.fixtureType,
      },
      selectedLocationId,
    )
    if (res.success) {
      const name = (rackForm.rackName || '').trim()
      if (name) {
        void import('@/utils/userEnteredNames').then(({ rememberUserEnteredName }) => {
          rememberUserEnteredName('rack', name)
        })
      }
      setShowRackModal(false)
    }
    return res.success
  }

  const placeRackOnFloor = () => {
    const errs = validateRackForm(selectedLocationId, rackForm)
    setRackErrors(errs)
    if (Object.keys(errs).length > 0) {
      setLocationValidationError(errs.location ?? null)
      return
    }
    setPendingRackParams({
      width: (parseFloat(rackForm.width) || 0) / 100 || DEFAULT_RACK_WIDTH,
      depth: (parseFloat(rackForm.depth) || 0) / 100 || DEFAULT_RACK_DEPTH,
      rackName: rackForm.rackName,
      globalLocationId: selectedLocationId,
      plankType: rackForm.plankType,
      sided: rackForm.fixtureType === 'GONDOLA' ? rackForm.sided : 'one',
      fixtureType: rackForm.fixtureType,
    })
    setIsPlacingRack(true)
    setShowRackModal(false)
  }

  // Rack selected → Show Add Row and Edit Rack buttons (bottom action bar)
  if (selectedType === "rack") {
    const rack = area.racks.find((r: Rack) => r.id === selectedId);
    const isCustom = rack && resolveFixtureType(rack) === "CUSTOM";
    return (
      <>
        <div
          className={cn(
            'flex flex-col gap-2',
            isSidebar ? 'w-full min-h-full' : 'items-start',
          )}
        >
          {rack && <RackPosmPanel rack={rack} dark={isSidebar} />}
          {rack && (
            <div
              className={cn(
                'w-full rounded-xl border p-2.5',
                isSidebar ? 'bg-[#111827] border-slate-600' : 'bg-white border-gray-200',
              )}
            >
              <ShelfUtilizationMeter rack={rack} dark={isSidebar} />
            </div>
          )}
          <ActionBar
            label="Rack selected"
            subtitle={rack ? displayRackName(rack) : undefined}
            layout={layout}
            className={isSidebar ? 'flex-1 min-h-0' : undefined}
            onHide={isSidebar ? () => setSelected('area', 'area') : undefined}
          >
            {isCustom && (
              <ActionBtn
                variant="secondary"
                fullWidth={isSidebar}
                onClick={() => openCustomRackBuilder("CUSTOM", selectedId)}
              >
                Customize
              </ActionBtn>
            )}
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => {
                setMoveRackError(null);
                setEditingRackId(selectedId);
              }}
            >
              Move Rack
            </ActionBtn>
            <div
              className={cn(
                'rounded-xl border p-2 space-y-2',
                isSidebar
                  ? 'w-full bg-[#1e293b] border-slate-600'
                  : 'bg-white border-gray-200',
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide',
                  isSidebar ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Rotate{' '}
                <span className={isSidebar ? 'text-gray-300' : 'text-gray-700'}>
                  {Math.round((((rack?.rotation?.y ?? 0) * 180) / Math.PI + 360) % 360)}°
                </span>
              </p>
              <div className={cn('flex gap-1.5', isSidebar ? 'flex-col' : 'flex-row')}>
                <ActionBtn
                  variant="secondary"
                  fullWidth={isSidebar}
                  onClick={() => selectedId && rotateRack(selectedId, -90)}
                  title="Rotate left 90°"
                >
                  <FiRotateCcw /> 90° Left
                </ActionBtn>
                <ActionBtn
                  variant="secondary"
                  fullWidth={isSidebar}
                  onClick={() => selectedId && rotateRack(selectedId, 90)}
                  title="Rotate right 90°"
                >
                  <FiRotateCw /> 90° Right
                </ActionBtn>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[0, 90, 180, 270].map((deg) => {
                  const currentDeg = Math.round((((rack?.rotation?.y ?? 0) * 180) / Math.PI + 360) % 360);
                  const active = currentDeg === deg;
                  return (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => selectedId && setRackRotationY(selectedId, (deg * Math.PI) / 180)}
                      className={cn(
                        'py-1.5 rounded-md text-[10px] font-semibold border transition-colors',
                        active
                          ? isSidebar
                            ? 'bg-brand text-white border-brand'
                            : 'bg-brand text-white border-brand'
                          : isSidebar
                            ? 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                      )}
                    >
                      {deg}°
                    </button>
                  );
                })}
              </div>
            </div>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              disabled={savingLayout || isSavingLayout}
              onClick={async () => {
                if (!selectedId) return;
                setSavingLayout(true);
                try {
                  const res = await saveRackLayoutToServer(selectedId);
                  if (!res.success) setAddRackError(res.message ?? 'Failed to save layout');
                  else setAddRackError(null);
                } finally {
                  setSavingLayout(false);
                }
              }}
            >
              {(savingLayout || isSavingLayout) ? (
                <Spinner />
              ) : (
                <FiSave />
              )}{' '}
              Save layout
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => setShowSavePlanogramModal(true)}
              title="Name this shelf face and upload an ideal rack photo"
            >
              <FiCamera /> Save as planogram
            </ActionBtn>
            <ActionBtn
              variant="primary"
              fullWidth={isSidebar}
              onClick={() => setShowMultiReflowModal(true)}
              title="ApplyMultiRackReflow — map onto existing racks (POST .../reflow-to-racks)"
            >
              <FiGitMerge /> Reflow to racks
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => setShowComplianceModal(true)}
              title="Review face fill, hero placement, SOS, and POSM before publish"
            >
              <FiCheckCircle /> Check compliance
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => setShowPublishModal(true)}
              title="Clone rack to other stores"
            >
              <FiShare2 /> Copy to stores
            </ActionBtn>
            {isSidebar ? (
              <ActionBtn
                variant="danger"
                fullWidth
                onClick={() => setConfirmDeleteRack(true)}
              >
                <FiTrash2 /> Delete rack
              </ActionBtn>
            ) : (
              <Button
                variant={"default"}
                size={"sm"}
                className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                onClick={() => setConfirmDeleteRack(true)}
              >
                <FiTrash2 />
              </Button>
            )}
            {editingRackId && (
              <ActionBtn variant="secondary" fullWidth={isSidebar} onClick={() => setEditingRackId(null)}>
                Cancel move
              </ActionBtn>
            )}
          </ActionBar>
          {editingRackId && (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-[11px] leading-snug',
                isSidebar
                  ? 'w-full bg-amber-500/15 border-amber-500/30 text-amber-100'
                  : 'bg-amber-50 border-amber-200 text-amber-900',
              )}
            >
              <p className="font-semibold">Moving rack</p>
              <p className={isSidebar ? 'text-amber-100/80 mt-0.5' : 'text-amber-800/80 mt-0.5'}>
                Click an empty floor cell · cannot overlap other racks
              </p>
            </div>
          )}
          {moveRackError && (
            <div
              className={cn(
                'px-3 py-2 rounded-lg border text-sm',
                isSidebar
                  ? 'bg-red-500/15 border-red-500/25 text-red-200 w-full text-[11px]'
                  : 'bg-red-50 border-red-200 text-red-700 max-w-md',
              )}
            >
              {moveRackError}
            </div>
          )}
          {saveLayoutError && (
            <div
              className={cn(
                'px-3 py-2 rounded-lg border text-sm',
                isSidebar
                  ? 'bg-amber-500/15 border-amber-500/25 text-amber-100 w-full text-[11px]'
                  : 'bg-amber-50 border-amber-200 text-amber-800 max-w-md',
              )}
            >
              {saveLayoutError}
            </div>
          )}
          {rack && (
            <RackRowHeightsPanel
              rack={rack}
              onSelectRow={(id) => setSelected(id, 'row')}
              onAddRow={() => {
                const bodyH = rack.customConfig
                  ? computeCustomRackDimensions(rack.customConfig).innerHeight
                  : Number(rack.outer?.height ?? rack.height) || 1.5
                const used = (rack.sides[0]?.rows ?? []).reduce(
                  (s, r) => s + (Number(r.height) || 0),
                  0,
                )
                const remaining = Math.max(0.1, bodyH - used)
                setRowForm({
                  height: cmInputFromM(remaining),
                  count: '1',
                })
                setShowRowModal(true)
              }}
            />
          )}
          {rack && <RackSideZonesPanel rack={rack} dark={isSidebar} />}
        </div>

        <AddRowModal
          open={showRowModal}
          onClose={() => setShowRowModal(false)}
          height={rowForm.height}
          onHeightChange={(v) => setRowForm({ ...rowForm, height: v })}
          count={rowForm.count}
          onCountChange={(v) => setRowForm({ ...rowForm, count: v })}
          availableHeightM={
            rack
              ? (() => {
                  const bodyH = rack.customConfig
                    ? computeCustomRackDimensions(rack.customConfig).innerHeight
                    : Number(rack.outer?.height ?? rack.height) || 1.5
                  const used = (rack.sides[0]?.rows ?? []).reduce(
                    (s, r) => s + (Number(r.height) || 0),
                    0,
                  )
                  return Math.max(0.1, bodyH - used)
                })()
              : undefined
          }
          isSubmitting={addingRow}
          onSubmit={async () => {
            if (!selectedId) return;
            setAddingRow(true);
            try {
              const h = parseFloat(rowForm.height) / 100 || GROCERY_SHELF_SPACING;
              const n = Math.max(1, Math.min(20, Math.floor(Number(rowForm.count) || 1)));
              let added = 0;
              let lastMsg: string | undefined;
              for (let i = 0; i < n; i++) {
                const res = await addRowToServer(selectedId, h, undefined, { quiet: i > 0 });
                if (!res.success) {
                  lastMsg = res.message;
                  break;
                }
                added += 1;
              }
              if (added === 0) setAddRackError(lastMsg ?? 'Failed to add row');
              else {
                setShowRowModal(false);
                if (added < n) {
                  toast(`${added} of ${n} rows added — ${lastMsg ?? 'no more height'}`);
                } else {
                  toast.success(added > 1 ? `Added ${added} rows` : 'Row added');
                }
              }
            } finally {
              setAddingRow(false);
            }
          }}
        />
        {rack && (
          <>
            <SaveAsPlanogramModal
              open={showSavePlanogramModal}
              onClose={() => setShowSavePlanogramModal(false)}
              rack={rack}
              onSaveLayout={async () => {
                const res = await saveRackLayoutToServer(rack.id)
                if (!res.success) {
                  setAddRackError(res.message ?? 'Failed to save layout')
                  return { success: false, message: res.message }
                }
                setAddRackError(null)
                return { success: true }
              }}
              onSuccess={({ name }) => {
                toast.success(`Planogram saved: ${name}`)
              }}
            />
            <RackPublishModal
              rack={rack}
              open={showPublishModal}
              onClose={() => setShowPublishModal(false)}
            />
            <Modal
              open={showComplianceModal}
              onClose={() => setShowComplianceModal(false)}
              title="Compliance checklist"
              subtitle="Review this rack before saving or copying to other stores."
              maxWidth="lg"
              footer={
                <Btn variant="primary" onClick={() => setShowComplianceModal(false)}>
                  Done
                </Btn>
              }
            >
              <ComplianceChecklist rack={rack} />
            </Modal>
            <MultiRackReflowModal
              rack={rack}
              open={showMultiReflowModal}
              onClose={() => setShowMultiReflowModal(false)}
            />
          </>
        )}
        <ConfirmModal
          open={confirmDeleteRack}
          title="Delete rack?"
          description="This removes the rack and every shelf, SKU, and POSM on it. This cannot be undone."
          confirmLabel="Delete rack"
          danger
          busy={confirmBusy}
          onClose={() => setConfirmDeleteRack(false)}
          onConfirm={async () => {
            setConfirmBusy(true)
            try {
              const res = await deleteRackFromServer(selectedId)
              if (!res.success) toastApiError(res.message)
              else setConfirmDeleteRack(false)
            } finally {
              setConfirmBusy(false)
            }
          }}
        />
      </>
    );
  }

  // Row selected → Show Add Bin button (bottom action bar)
  if (selectedType === "row") {
    const rack = area.racks.find((r: Rack) =>
      r.sides.some((s: RackSide) =>
        s.rows.some((row: Row) => row.id === selectedId),
      ),
    );
    const row = rack?.sides
      .find((s: RackSide) => s.rows.some((r: Row) => r.id === selectedId))
      ?.rows.find((r: Row) => r.id === selectedId);
    const rowMaxWidth =
      rack?.customConfig
        ? computeCustomRackDimensions(rack.customConfig).innerWidth
        : rack
          ? rack.width * 0.85
          : undefined;

    return (
      <>
        <div
          className={cn(
            'flex flex-col gap-2',
            isSidebar ? 'w-full' : 'items-start',
          )}
        >
          {row && (
            <div
              className={cn(
                'w-full rounded-xl border p-2.5',
                isSidebar ? 'bg-[#111827] border-slate-600' : 'bg-white border-gray-200',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    isSidebar ? 'text-gray-400' : 'text-gray-500',
                  )}
                >
                  Row size (W × H)
                </p>
                <RowFaceFillChip row={row} rack={rack} />
              </div>
              <ShelfUtilizationMeter row={row} dark={isSidebar} className="mb-1.5" />
              <RowDimensionsField
                row={row}
                dark={isSidebar}
                showLabel={false}
                maxWidth={rowMaxWidth}
              />
            </div>
          )}
          {row && !hidePosmPanel && <RowDividerPosmPanel row={row} dark={isSidebar} />}
          <ActionBar
            label="Row selected"
            subtitle="Place SKUs from the product library onto this shelf"
            layout={layout}
            onHide={isSidebar ? () => setSelected('area', 'area') : undefined}
          >
          <ActionBtn
            fullWidth={isSidebar}
            variant="secondary"
            onClick={() => {
              const res = copySelection();
              if (res.success) toast.success(res.message ?? 'Copied');
              else toast.error(res.message ?? 'Copy failed');
            }}
            title="Ctrl+C — copy each SKU on this shelf"
          >
            <FiCopy /> Copy SKUs
          </ActionBtn>
          <ActionBtn
            fullWidth={isSidebar}
            variant="secondary"
            disabled={!clipboard}
            onClick={() => {
              void (async () => {
                const res = await pasteClipboard();
                if (res.success) toast.success(res.message ?? 'Pasted');
                else toast.error(res.message ?? 'Paste failed');
              })();
            }}
            title="Ctrl+V — paste copied SKU content onto this shelf"
          >
            <FiClipboard /> {clipboard?.kind === 'sku' ? 'Paste SKU' : 'Paste SKUs'}
          </ActionBtn>
          {isSidebar ? (
            <ActionBtn
              variant="danger"
              fullWidth
              onClick={() => setConfirmDeleteRow(true)}
            >
              <FiTrash2 /> Delete row
            </ActionBtn>
          ) : (
            <Button
              variant={"default"}
              size={"sm"}
              className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => setConfirmDeleteRow(true)}
            >
              <FiTrash2 />
            </Button>
          )}
        </ActionBar>
        </div>
        <ConfirmModal
          open={confirmDeleteRow}
          title="Delete row?"
          description="All products on this shelf will be removed. This cannot be undone."
          confirmLabel="Delete row"
          danger
          busy={confirmBusy}
          onClose={() => setConfirmDeleteRow(false)}
          onConfirm={async () => {
            setConfirmBusy(true)
            try {
              const res = await deleteRowFromServer(selectedId)
              if (!res.success) toastApiError(res.message)
              else {
                toast.success(res.message ?? 'Row deleted')
                setConfirmDeleteRow(false)
              }
            } finally {
              setConfirmBusy(false)
            }
          }}
        />
      </>
    );
  }

  // Bins are an internal layout slot — never shown as a portal object.
  if (selectedType === "bin") {
    return null
  }

  if (selectedType === "product") {
    const deleteProductFromServer = usePlanogramStore.getState().deleteProductFromServer;
    let hostBinId: string | null = null
    if (selectedId) {
      const catalogId = resolveProductFacingId(selectedId)
      outer: for (const r of area.racks) {
        for (const s of r.sides) {
          for (const row of s.rows) {
            for (const b of row.bins) {
              if (
                b.products.some(
                  (p) => p.id === selectedId || resolveProductFacingId(p.id) === catalogId,
                )
              ) {
                hostBinId = b.id
                break outer
              }
            }
          }
        }
      }
    }
    return (
      <>
      <div className={cn('flex flex-col gap-2', isSidebar ? 'w-full' : 'items-start')}>
        {hostBinId && (
          <BinInventoryPanel
            binId={hostBinId}
            dark={isSidebar}
            refreshKey={inventoryRefreshKey}
            onInventoryChange={() => setInventoryRefreshKey((k) => k + 1)}
          />
        )}
        <ActionBar
          label="Product selected"
          subtitle="SKU actions"
          layout={layout}
          onHide={isSidebar ? () => setSelected('area', 'area') : undefined}
        >
        {isSidebar ? (
          <ActionBtn
            variant="danger"
            fullWidth
            onClick={() => setConfirmDetachProduct(true)}
          >
            <FiTrash2 /> Remove SKU & slot
          </ActionBtn>
        ) : (
          <Button
            variant={"default"}
            size={"sm"}
            className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            onClick={() => setConfirmDetachProduct(true)}
          >
            <FiTrash2 />
          </Button>
        )}
      </ActionBar>
      </div>
      <ConfirmModal
        open={confirmDetachProduct}
        title="Detach product?"
        description="This removes the SKU from the shelf slot. The slot is deleted with it."
        confirmLabel="Detach product"
        danger
        busy={confirmBusy}
        onClose={() => setConfirmDetachProduct(false)}
        onConfirm={async () => {
          setConfirmBusy(true)
          try {
            const res = await deleteProductFromServer(selectedId)
            if (!res.success) toastApiError(res.message)
            else {
              toast.success(res.message ?? 'Inventory detached')
              setInventoryRefreshKey((k) => k + 1)
              setConfirmDetachProduct(false)
            }
          } finally {
            setConfirmBusy(false)
          }
        }}
      />
      </>
    );
  }

  return null;
}
