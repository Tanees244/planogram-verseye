"use client";

import {
  usePlanogramStore,
  type Rack,
  type RackSide,
  type Row,
} from "@/store/planogramStore";
import { useState, useEffect, useCallback } from "react";

interface Location {
  id: string;
  locationCode: string;
  isActive: boolean;
  isArchived: boolean;
}
import { Button } from "@verseye/ui";
import { FiTrash2, FiSave, FiRotateCcw, FiRotateCw, FiShare2, FiDownload, FiMaximize2, FiGitMerge } from "react-icons/fi";
import { getPlanogramTokenFromCookie } from "@verseye/utils";
import AttachProductToBinModal from "./AttachProductToBinModal";
import { BinInventoryPanel } from "./BinInventoryPanel";
import { toastApiError } from "@/utils/apiMessages";
import toast from "react-hot-toast";
import { Spinner } from "./Spinner";
import { AddRackModal, type RackFormState } from '@/components/forms/AddRackModal'
import { AddRowModal } from '@/components/forms/AddRowModal'
import { AddBinModal } from '@/components/forms/AddBinModal'
import { ActionBar, ActionBtn } from '@/components/ui/ActionBar'
import { RackRowHeightsPanel, RowDimensionsField } from '@/components/RowHeightsEditor'
import { RackPosmPanel } from '@/components/RackPosmPanel'
import { RackSideZonesPanel } from '@/components/RackSideZonesPanel'
import { RowDividerPosmPanel } from '@/components/RowDividerPosmPanel'
import { RackPublishModal } from '@/components/RackPublishModal'
import { RackReflowModal } from '@/components/RackReflowModal'
import { MultiRackReflowModal } from '@/components/MultiRackReflowModal'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'
import { resolveFixtureType } from '@/components/fixtures/types'
import { validateRackForm, defaultRackForm } from '@/utils/rackFormUtils'
import {
  DEFAULT_RACK_DEPTH,
  DEFAULT_RACK_WIDTH,
  GROCERY_SHELF_SPACING,
} from '@/constants/dimensions'
import { cn } from '@/lib/cn'
import { usePlanogramExport } from '@/utils/planogramExport'
export function ContextAddButton({ layout = 'horizontal' }: { layout?: 'horizontal' | 'sidebar' }) {
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
    deleteRow,
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
  } = usePlanogramStore();

  const [showRackModal, setShowRackModal] = useState(false);
  const [showRowModal, setShowRowModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Per-action loading states for addition buttons
  const [addingRow, setAddingRow] = useState(false);
  const [addingBin, setAddingBin] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showReflowModal, setShowReflowModal] = useState(false);
  const [showMultiReflowModal, setShowMultiReflowModal] = useState(false);
  const { exportRack } = usePlanogramExport();

  // Add Bin modal state
  const [showBinModal, setShowBinModal] = useState(false);
  const [binNameInput, setBinNameInput] = useState("");
  const [binWidthInput, setBinWidthInput] = useState("");
  const [binDepthInput, setBinDepthInput] = useState("");
  const [binHeightInput, setBinHeightInput] = useState("");
  const [binNameError, setBinNameError] = useState<string | null>(null);

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

  const [rowForm, setRowForm] = useState({ height: String(GROCERY_SHELF_SPACING) });

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
    const w = parseFloat(rackForm.width)
    const d = parseFloat(rackForm.depth)
    const res = await addRackToServer(
      position,
      {
        width: w,
        depth: d,
        rackCode: rackForm.rackCode,
        rackName: rackForm.rackName,
        plankType: rackForm.plankType,
        sided: rackForm.fixtureType === 'GONDOLA' ? rackForm.sided : 'one',
        fixtureType: rackForm.fixtureType,
      },
      selectedLocationId,
    )
    if (res.success) setShowRackModal(false)
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
      width: parseFloat(rackForm.width) || DEFAULT_RACK_WIDTH,
      depth: parseFloat(rackForm.depth) || DEFAULT_RACK_DEPTH,
      rackCode: rackForm.rackCode,
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
          <ActionBar
            label="Rack selected"
            layout={layout}
            className={isSidebar ? 'flex-1 min-h-0' : undefined}
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
            <ActionBtn fullWidth={isSidebar} onClick={() => setShowRowModal(true)}>
              <span className="text-lg leading-none">+</span> Add Row
            </ActionBtn>
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
                  ? 'w-full bg-black/40 border-white/10'
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
              variant="primary"
              fullWidth={isSidebar}
              onClick={() => setShowReflowModal(true)}
              title="ApplyRackReflow — resize this rack (POST .../reflow)"
            >
              <FiMaximize2 /> Reflow preview
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => setShowMultiReflowModal(true)}
              title="ApplyMultiRackReflow — map onto existing racks (POST .../reflow-to-racks)"
            >
              <FiGitMerge /> Reflow to racks
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => setShowPublishModal(true)}
              title="Clone rack to other stores"
            >
              <FiShare2 /> Publish to stores
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => rack && exportRack(rack, 'plm')}
              title="Export rack as .plm (Planogram Layout Model)"
            >
              <FiDownload /> Export PLM
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              fullWidth={isSidebar}
              onClick={() => rack && exportRack(rack, 'psa')}
              title="Export rack as .psa (JDA Space Planning compatible)"
            >
              <FiDownload /> Export PSA
            </ActionBtn>
            {isSidebar ? (
              <ActionBtn
                variant="danger"
                fullWidth
                onClick={async () => {
                  const res = await deleteRackFromServer(selectedId)
                  if (!res.success) {
                    alert(res.message)
                  }
                }}
              >
                <FiTrash2 /> Delete rack
              </ActionBtn>
            ) : (
              <Button
                variant={"default"}
                size={"sm"}
                className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                onClick={async () => {
                  const res = await deleteRackFromServer(selectedId)
                  if (!res.success) {
                    alert(res.message)
                  }
                }}
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
            <span
              className={cn(
                'text-sm px-3 py-1.5 rounded-lg border text-[11px] leading-snug',
                isSidebar
                  ? 'bg-brand/15 border-brand/30 text-gray-200 w-full'
                  : 'text-gray-600 bg-white/90 border-gray-200',
              )}
            >
              Click on the floor to move the rack
            </span>
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
          {rack && <RackRowHeightsPanel rack={rack} onSelectRow={(id) => setSelected(id, 'row')} />}
          {rack && <RackSideZonesPanel rack={rack} dark={isSidebar} />}
        </div>

        <AddRowModal
          open={showRowModal}
          onClose={() => setShowRowModal(false)}
          height={rowForm.height}
          onHeightChange={(v) => setRowForm({ ...rowForm, height: v })}
          isSubmitting={addingRow}
          onSubmit={async () => {
            if (!selectedId) return;
            setAddingRow(true);
            try {
              const res = await addRowToServer(selectedId, parseFloat(rowForm.height) || GROCERY_SHELF_SPACING);
              if (!res.success) setAddRackError(res.message);
              else setShowRowModal(false);
            } finally {
              setAddingRow(false);
            }
          }}
        />
        {rack && (
          <>
            <RackPublishModal
              rack={rack}
              open={showPublishModal}
              onClose={() => setShowPublishModal(false)}
            />
            <RackReflowModal
              rack={rack}
              open={showReflowModal}
              onClose={() => setShowReflowModal(false)}
            />
            <MultiRackReflowModal
              rack={rack}
              open={showMultiReflowModal}
              onClose={() => setShowMultiReflowModal(false)}
            />
          </>
        )}
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
    const rowExtent1 = undefined;
    const rowExtent2 = undefined;
    const rowHeightForBin = row?.height;
    const rowMaxWidth =
      rack?.customConfig
        ? computeCustomRackDimensions(rack.customConfig).innerWidth
        : rack
          ? rack.width * 0.85
          : undefined;

    const handleAddBin = async () => {
      if (!selectedId) {
        setBinNameError("No row selected");
        return;
      }
      if (!binNameInput || !binNameInput.trim()) {
        setBinNameError("Bin name is required");
        return;
      }
      setAddingBin(true);
      try {
        const parsedDims = {
          width: parseFloat(binWidthInput) || undefined,
          depth: parseFloat(binDepthInput) || undefined,
          height: parseFloat(binHeightInput) || undefined,
        };
        const res = await addBinToServer(
          selectedId,
          rowExtent1,
          rowExtent2,
          rowHeightForBin,
          binNameInput.trim(),
          parsedDims,
        );
        if (!res.success) {
          setBinNameError(res.message);
        } else {
          setShowBinModal(false);
          setBinNameInput("");
          setBinWidthInput("");
          setBinDepthInput("");
          setBinHeightInput("");
          setBinNameError(null);
        }
      } finally {
        setAddingBin(false);
      }
    };

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
                isSidebar ? 'bg-black/70 border-white/10' : 'bg-white border-gray-200',
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide mb-1.5',
                  isSidebar ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Row size (W × H)
              </p>
              <RowDimensionsField
                row={row}
                dark={isSidebar}
                showLabel={false}
                maxWidth={rowMaxWidth}
              />
            </div>
          )}
          {row && <RowDividerPosmPanel row={row} dark={isSidebar} />}
          <ActionBar label="Row selected" layout={layout}>
          <ActionBtn
            fullWidth={isSidebar}
            onClick={() => {
              setBinNameInput("");
              setBinWidthInput("");
              setBinDepthInput("");
              setBinHeightInput("");
              setBinNameError(null);
              setShowBinModal(true);
            }}
          >
            <span className="text-lg leading-none">+</span> Add Bin
          </ActionBtn>
          {isSidebar ? (
            <ActionBtn variant="danger" fullWidth onClick={() => deleteRow(selectedId)}>
              <FiTrash2 /> Delete row
            </ActionBtn>
          ) : (
            <Button
              variant={"default"}
              size={"sm"}
              className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => deleteRow(selectedId)}
            >
              <FiTrash2 />
            </Button>
          )}
        </ActionBar>
        </div>

        <AddBinModal
          open={showBinModal}
          onClose={() => !addingBin && setShowBinModal(false)}
          binName={binNameInput}
          binWidth={binWidthInput}
          binDepth={binDepthInput}
          binHeight={binHeightInput}
          onBinNameChange={(v) => { setBinNameInput(v); setBinNameError(null); }}
          onBinWidthChange={setBinWidthInput}
          onBinDepthChange={setBinDepthInput}
          onBinHeightChange={setBinHeightInput}
          error={binNameError}
          isSubmitting={addingBin}
          onSubmit={handleAddBin}
        />
      </>
    );
  }

  // Bin selected
  if (selectedType === "bin") {
    return (
      <>
        <div className="space-y-2 w-full">
          <BinInventoryPanel
            binId={selectedId}
            dark={isSidebar}
            refreshKey={inventoryRefreshKey}
            onInventoryChange={() => setInventoryRefreshKey((k) => k + 1)}
          />
          <ActionBar label="Bin selected" layout={layout}>
            <ActionBtn fullWidth={isSidebar} onClick={() => setShowProductModal(true)}>
              <span className="text-lg leading-none">+</span> Attach Product
            </ActionBtn>
            {isSidebar ? (
              <ActionBtn
                variant="danger"
                fullWidth
                onClick={async () => {
                  const res = await deleteBinFromServer(selectedId)
                  if (!res.success) alert(res.message)
                }}
              >
                <FiTrash2 /> Delete bin
              </ActionBtn>
            ) : (
              <Button
                variant={"default"}
                size={"sm"}
                className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                onClick={async () => {
                  const res = await deleteBinFromServer(selectedId)
                  if (!res.success) alert(res.message)
                }}
              >
                <FiTrash2 />
              </Button>
            )}
          </ActionBar>
        </div>

        <AttachProductToBinModal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          binId={selectedId}
          onSuccess={handleAttachProductSuccess}
          inventoryRefreshKey={inventoryRefreshKey}
        />
      </>
    );
  }

  if (selectedType === "product") {
    const deleteProductFromServer = usePlanogramStore.getState().deleteProductFromServer;
    return (
      <ActionBar label="Product selected" layout={layout}>
        {isSidebar ? (
          <ActionBtn
            variant="danger"
            fullWidth
            onClick={async () => {
              const res = await deleteProductFromServer(selectedId);
              if (!res.success) toastApiError(res.message);
              else {
                toast.success(res.message ?? 'Inventory detached');
                setInventoryRefreshKey((k) => k + 1);
              }
            }}
          >
            <FiTrash2 /> Detach product
          </ActionBtn>
        ) : (
          <Button
            variant={"default"}
            size={"sm"}
            className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            onClick={async () => {
              const res = await deleteProductFromServer(selectedId);
              if (!res.success) toastApiError(res.message);
              else {
                toast.success(res.message ?? 'Inventory detached');
                setInventoryRefreshKey((k) => k + 1);
              }
            }}
          >
            <FiTrash2 />
          </Button>
        )}
      </ActionBar>
    );
  }

  return null;
}
