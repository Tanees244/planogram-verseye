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
export function ContextAddButton() {
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
    addProductToServer,
  } = usePlanogramStore();

  const [showRackModal, setShowRackModal] = useState(false);
  const [showRowModal, setShowRowModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Location state for the Add Rack form
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
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

  const [rackForm, setRackForm] = useState({
    width: "2.5",
    height: "2",
    rackCode: "",
    plankType: "standard",
    sided: "one" as "one" | "two",
  });
  const [rackErrors, setRackErrors] = useState<{
    location?: string | null;
    rackCode?: string | null;
    width?: string | null;
    height?: string | null;
    plankType?: string | null;
    sided?: string | null;
  }>({});
  const [isRackFormValid, setIsRackFormValid] = useState(false);

  const validateRackForm = (
    locId: string,
    form: typeof rackForm,
  ): Record<string, string | null> => {
    const errors: Record<string, string | null> = {};
    if (!locId || !locId.trim()) errors.location = "Location is required";
    if (!form.rackCode || !form.rackCode.trim())
      errors.rackCode = "Rack Code is required";
    const w = parseFloat(form.width);
    if (!form.width || Number.isNaN(w) || w <= 0)
      errors.width = "Width must be a positive number";
    const h = parseFloat(form.height);
    if (!form.height || Number.isNaN(h) || h <= 0)
      errors.height = "Height must be a positive number";
    if (!form.plankType || !form.plankType.trim())
      errors.plankType = "Plank type is required";
    if (!form.sided || (form.sided !== "one" && form.sided !== "two"))
      errors.sided = "Sides is required";
    return errors;
  };
  const [rowForm, setRowForm] = useState({ height: "1.5" });

  const { attachProductToBin } = usePlanogramStore();
  const handleAttachProductSuccess = async (product: any, quantity: number) => {
    if (!selectedId) return;
    await attachProductToBin(selectedId, product, quantity);
  };

  if (!selectedId || !selectedType) return null;

  const actionBarClass =
    "flex items-center gap-3 px-4 py-3 bg-black/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/10 w-fit";

  // Area selected → Show Add Rack button (bottom action bar)
  if (selectedType === "area") {
    return (
      <>
        <div className="flex flex-col gap-2 items-start">
          <div className={actionBarClass}>
            <span className="text-gray-300 text-sm">Area selected</span>
            <button
              onClick={() => {
                setAddRackError(null);
                setShowRackModal(true);
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <span className="text-lg">+</span>
              Add Rack
            </button>
          </div>
          {addRackError && (
            <div className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm max-w-md">
              {addRackError}
            </div>
          )}
        </div>

        {showRackModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowRackModal(false)}
          >
            <div
              style={{
                background: "#2c3e50",
                color: "#ecf0f1",
                padding: "24px",
                borderRadius: "8px",
                minWidth: "320px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>New Rack</h3>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "12px",
                  color: "#bdc3c7",
                }}
              >
                Warehouse floor: {area.width} m × {area.depth} m
              </p>
              {addRackError && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "8px",
                    borderRadius: "4px",
                    background: "rgba(231,76,60,0.2)",
                    border: "1px solid rgba(231,76,60,0.5)",
                    color: "#e74c3c",
                    fontSize: "13px",
                  }}
                >
                  {addRackError}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Location dropdown */}
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: "13px",
                  }}
                >
                  Location *
                  <select
                    value={selectedLocationId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLocationId(v);
                      setLocationValidationError(null);
                      const errs = validateRackForm(v, rackForm);
                      setRackErrors(errs);
                      setIsRackFormValid(Object.keys(errs).length === 0);
                    }}
                    disabled={locationsLoading}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: locationValidationError
                        ? "1px solid #e74c3c"
                        : "1px solid #34495e",
                      opacity: locationsLoading ? 0.6 : 1,
                    }}
                    className="text-black"
                  >
                    <option value="">
                      {locationsLoading
                        ? "Loading locations…"
                        : "Select a location"}
                    </option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.locationCode}
                      </option>
                    ))}
                  </select>
                  {locationValidationError && (
                    <span style={{ color: "#e74c3c", fontSize: "12px" }}>
                      {locationValidationError}
                    </span>
                  )}
                  {rackErrors.location && (
                    <span style={{ color: "#e74c3c", fontSize: "12px" }}>
                      {rackErrors.location}
                    </span>
                  )}
                  {locationsError && (
                    <span style={{ color: "#e67e22", fontSize: "12px" }}>
                      {locationsError}
                    </span>
                  )}
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: "13px",
                  }}
                >
                  Rack Code *
                  <input
                    type="text"
                    value={rackForm.rackCode}
                    onChange={(e) => {
                      const newForm = { ...rackForm, rackCode: e.target.value };
                      setRackForm(newForm);
                      const errs = validateRackForm(selectedLocationId, newForm);
                      setRackErrors(errs);
                      setIsRackFormValid(Object.keys(errs).length === 0);
                    }}
                    placeholder="Enter rack code"
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #34495e",
                    }}
                    className="text-black"
                  />
                  {rackErrors.rackCode && (
                    <span style={{ color: "#e74c3c", fontSize: "12px" }}>
                      {rackErrors.rackCode}
                    </span>
                  )}
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: "13px",
                  }}
                >
                  Width (m)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rackForm.width}
                    onChange={(e) => {
                      const newForm = { ...rackForm, width: e.target.value };
                      setRackForm(newForm);
                      const errs = validateRackForm(selectedLocationId, newForm);
                      setRackErrors(errs);
                      setIsRackFormValid(Object.keys(errs).length === 0);
                    }}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #34495e",
                    }}
                    className="text-black"
                  />
                </label>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: "13px",
                  }}
                >
                  Height (m)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rackForm.height}
                    onChange={(e) => {
                      const newForm = { ...rackForm, height: e.target.value };
                      setRackForm(newForm);
                      const errs = validateRackForm(selectedLocationId, newForm);
                      setRackErrors(errs);
                      setIsRackFormValid(Object.keys(errs).length === 0);
                    }}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #34495e",
                    }}
                    className="text-black"
                  />
                </label>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    fontSize: "13px",
                  }}
                >
                  Sides
                  <select
                    value={rackForm.sided}
                    onChange={(e) => {
                      const newForm = {
                        ...rackForm,
                        sided: e.target.value as "one" | "two",
                      };
                      setRackForm(newForm);
                      const errs = validateRackForm(selectedLocationId, newForm);
                      setRackErrors(errs);
                      setIsRackFormValid(Object.keys(errs).length === 0);
                    }}
                    style={{
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #34495e",
                    }}
                    className="text-black"
                  >
                    <option value="one">One sided</option>
                    <option value="two">Two sided</option>
                  </select>
                  {rackErrors.sided && (
                    <span style={{ color: "#e74c3c", fontSize: "12px" }}>
                      {rackErrors.sided}
                    </span>
                  )}
                </label>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "20px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setShowRackModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #7f8c8d",
                    background: "transparent",
                    color: "#bdc3c7",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const errs = validateRackForm(selectedLocationId, rackForm);
                    setRackErrors(errs);
                    setIsRackFormValid(Object.keys(errs).length === 0);
                    if (Object.keys(errs).length > 0) {
                      setLocationValidationError(errs.location ?? null);
                      return;
                    }
                    setPendingRackParams({
                      width: parseFloat(rackForm.width) || 2.5,
                      depth: parseFloat(rackForm.height) || 2,
                      rackCode: rackForm.rackCode,
                      globalLocationId: selectedLocationId,
                      plankType: rackForm.plankType,
                      sided: rackForm.sided,
                    });
                    setIsPlacingRack(true);
                    setShowRackModal(false);
                  }}
                  disabled={isAddingRack || !isRackFormValid}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    background: isAddingRack ? "#7f8c8d" : "#2ecc71",
                    color: "white",
                    cursor: isAddingRack ? "not-allowed" : "pointer",
                    opacity: isAddingRack ? 0.7 : 1,
                  }}
                >
                  Place on floor
                </button>
                <button
                  onClick={async () => {
                    const errs = validateRackForm(selectedLocationId, rackForm);
                    setRackErrors(errs);
                    setIsRackFormValid(Object.keys(errs).length === 0);
                    if (Object.keys(errs).length > 0) {
                      setLocationValidationError(errs.location ?? null);
                      return;
                    }
                    const w = parseFloat(rackForm.width);
                    const h = parseFloat(rackForm.height);
                    const res = await addRackToServer(
                      undefined,
                      {
                        width: w,
                        depth: h,
                        rackCode: rackForm.rackCode,
                        plankType: rackForm.plankType,
                        sided: rackForm.sided,
                      },
                      selectedLocationId,
                    );
                    if (res.success) {
                      setShowRackModal(false);
                    }
                  }}
                  disabled={isAddingRack || !isRackFormValid}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    background: isAddingRack ? "#7f8c8d" : "#3498db",
                    color: "white",
                    cursor: isAddingRack ? "not-allowed" : "pointer",
                    opacity: isAddingRack ? 0.7 : 1,
                  }}
                >
                  {isAddingRack ? "Adding..." : "Add at center"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Rack selected → Show Add Row and Edit Rack buttons (bottom action bar)
  if (selectedType === "rack") {
    return (
      <>
        <div className="flex flex-col gap-2 items-start">
          <div className={actionBarClass}>
            <span className="text-gray-300 text-sm">Rack selected</span>
            <button
              onClick={() => setShowRowModal(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <span className="text-lg">+</span>
              Add Row
            </button>
            <button
              onClick={() => {
                setMoveRackError(null);
                setEditingRackId(selectedId);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              Edit Rack
            </button>
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
            {editingRackId && (
              <button
                onClick={() => setEditingRackId(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-semibold"
              >
                Cancel move
              </button>
            )}
          </div>
          {editingRackId && (
            <span className="text-amber-200 text-sm">
              Click on the floor to move the rack
            </span>
          )}
          {moveRackError && (
            <div className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm max-w-md">
              {moveRackError}
            </div>
          )}
        </div>

        {showRowModal && selectedId && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowRowModal(false)}
          >
            <div
              style={{
                background: "#2c3e50",
                color: "#ecf0f1",
                padding: "24px",
                borderRadius: "8px",
                minWidth: "280px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>New Row</h3>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "12px",
                  color: "#7f8c8d",
                }}
              >
                Row follows rack: two-sided rack → row on both sides.
              </p>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "13px",
                }}
              >
                Height (m)
                <input
                  type="text"
                  inputMode="decimal"
                  value={rowForm.height}
                  onChange={(e) =>
                    setRowForm({ ...rowForm, height: e.target.value })
                  }
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #34495e",
                  }}
                  className="text-black"
                />
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "20px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowRowModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #7f8c8d",
                    background: "transparent",
                    color: "#bdc3c7",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const res = await addRowToServer(selectedId, parseFloat(rowForm.height) || 1.5);
                    if (!res.success) {
                      // use store error slot for visibility
                      setAddRackError(res.message);
                    } else {
                      setShowRowModal(false);
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    background: "#e67e22",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Add Row
                </button>
              </div>
            </div>
          </div>
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
    const rowExtent1 = rack ? rack.width * 0.85 : undefined;
    const rowExtent2 = rack ? rack.depth * 0.9 : undefined;
    const rowHeightForBin = row?.height;

    return (
      <div className={actionBarClass}>
        <span className="text-gray-300 text-sm">Row selected</span>
        <button
          onClick={async () => {
            if (!selectedId) {
              setAddRackError('No row selected');
              return;
            }
            const res = await addBinToServer(selectedId, rowExtent1, rowExtent2, rowHeightForBin);
            if (!res.success) setAddRackError(res.message);
          }}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span className="text-lg">+</span>
          Add Bin
        </button>
        <Button
          variant={"default"}
          size={"sm"}
          className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          onClick={() => deleteRow(selectedId)}
        >
          <FiTrash2 />
        </Button>
      </div>
    );
  }

  // Bin selected → Show Add Product button (bottom action bar)
  if (selectedType === "bin") {
    return (
      <>
        <div className={actionBarClass}>
          <span className="text-gray-300 text-sm">Bin selected</span>
          <button
            onClick={() => setShowProductModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <span className="text-lg">+</span>
            Add Product
          </button>
          <Button
            variant={"default"}
            size={"sm"}
            className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            onClick={() => deleteBin(selectedId)}
          >
            <FiTrash2 />
          </Button>
        </div>

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
