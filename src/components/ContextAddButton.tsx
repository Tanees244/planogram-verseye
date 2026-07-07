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
import { FiTrash2 } from "react-icons/fi";
import { getPlanogramTokenFromCookie } from "@verseye/utils";
import AttachProductToBinModal from "./AttachProductToBinModal";
import { Spinner } from "./Spinner";
import { AddRackModal, type RackFormState } from '@/components/forms/AddRackModal'
import { AddRowModal } from '@/components/forms/AddRowModal'
import { AddBinModal } from '@/components/forms/AddBinModal'
import { ActionBar, ActionBtn } from '@/components/ui/ActionBar'
import { RackRowHeightsPanel, RowDimensionsField } from '@/components/RowHeightsEditor'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'
import { resolveFixtureType } from '@/components/fixtures/types'
import { validateRackForm } from '@/utils/rackFormUtils'
import type { FixtureType } from '@/components/fixtures/types'
import { cn } from '@/lib/cn'
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
    deleteBin,
    deleteProduct,
    addProduct,
    openCustomRackBuilder,
    customRackBuilderOpen,
    setSelected,
  } = usePlanogramStore();

  const [showRackModal, setShowRackModal] = useState(false);
  const [showRowModal, setShowRowModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Per-action loading states for addition buttons
  const [addingRow, setAddingRow] = useState(false);
  const [addingBin, setAddingBin] = useState(false);

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

  // When user clicks a bin in Advanced view, open Add Product modal directly
  useEffect(() => {
    if (selectedType === "bin" && selectedId) {
      setShowProductModal(true);
    }
  }, [selectedType, selectedId]);

  const [rackForm, setRackForm] = useState<RackFormState>({
    width: "2.5",
    depth: "1.2",
    rackCode: "",
    plankType: "standard",
    sided: "one" as "one" | "two",
    fixtureType: "GONDOLA" as FixtureType,
  });
  const [rackErrors, setRackErrors] = useState<Record<string, string | null>>({});
  const [isRackFormValid, setIsRackFormValid] = useState(false);

  const [rowForm, setRowForm] = useState({ height: "1.5" });

  const { attachProductToBin } = usePlanogramStore();

  const handleAttachProductSuccess = async (product: any, quantity: number) => {
    if (!selectedId) return;
    const result = await attachProductToBin(selectedId, product, quantity);
    if (!result.success && (result as { message?: string }).message) {
      alert((result as { message?: string }).message);
    }
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
      width: parseFloat(rackForm.width) || 2.5,
      depth: parseFloat(rackForm.depth) || 2,
      rackCode: rackForm.rackCode,
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
        <div className={cn('flex flex-col gap-2', isSidebar ? 'w-full' : 'items-start')}>
          <ActionBar label="Rack selected" layout={layout}>
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
          {rack && <RackRowHeightsPanel rack={rack} onSelectRow={(id) => setSelected(id, 'row')} />}
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
              const res = await addRowToServer(selectedId, parseFloat(rowForm.height) || 1.5);
              if (!res.success) setAddRackError(res.message);
              else setShowRowModal(false);
            } finally {
              setAddingRow(false);
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
    const rowExtent1 = rack ? rack.width * 0.85 : undefined;
    const rowExtent2 = rack ? rack.depth * 0.9 : undefined;
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
        <div className={cn('flex flex-col gap-2', isSidebar ? 'w-full' : 'items-start')}>
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
        <ActionBar label="Bin selected" layout={layout}>
          <ActionBtn fullWidth={isSidebar} onClick={() => setShowProductModal(true)}>
            <span className="text-lg leading-none">+</span> Attach Product
          </ActionBtn>
          {isSidebar ? (
            <ActionBtn variant="danger" fullWidth onClick={() => deleteBin(selectedId)}>
              <FiTrash2 /> Delete bin
            </ActionBtn>
          ) : (
            <Button
              variant={"default"}
              size={"sm"}
              className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => deleteBin(selectedId)}
            >
              <FiTrash2 />
            </Button>
          )}
        </ActionBar>

        <AttachProductToBinModal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          binId={selectedId}
          onSuccess={handleAttachProductSuccess}
        />
      </>
    );
  }

  return null;
}
