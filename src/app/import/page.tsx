"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanogramStore } from "@/store/planogramStore";
import {
  detectPlanogramFormat,
  isLegacyPlanogramJson,
  migrateLegacyJsonLabel,
  type ImportReport,
} from "@/lib/planogram-formats";
import { PlanogramImportReport } from "@/components/PlanogramImportReport";
import {
  FiUpload,
  FiX,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";

export default function ImportPage() {
  const router = useRouter();
  const loadFromJSON = usePlanogramStore((state) => state.loadFromJSON);
  const importPlanogramFromContent = usePlanogramStore(
    (state) => state.importPlanogramFromContent,
  );
  const [fileInput, setFileInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);

  const handleImport = async () => {
    try {
      setError(null);
      setImportReport(null);
      setIsLoading(true);
      setProgress(0);

      const content = fileInput.trim();
      if (!content) {
        setError("Paste a planogram file or upload one first.");
        return;
      }

      const format = detectPlanogramFormat(content);
      setDetectedFormat(format);

      if (format === "legacy-json") {
        const parsed = JSON.parse(content);
        if (!isLegacyPlanogramJson(parsed)) {
          setError("Legacy JSON is missing layout.racks[]");
          return;
        }
        router.push("/");
        await loadFromJSON(parsed, setProgress);
        setImportReport({
          format: "legacy-json",
          planogramName: migrateLegacyJsonLabel(),
          racksImported: parsed.layout?.racks?.length ?? 0,
          rowsImported: 0,
          binsImported: 0,
          productsImported: 0,
          facingsImported: 0,
          issues: [
            {
              severity: "warning",
              code: "LegacyMigrated",
              message:
                "Imported via legacy JSON migration path. Consider re-exporting as PLM for full fidelity.",
            },
          ],
        });
        return;
      }

      if (format === "unknown") {
        setError(
          "Unrecognized file format. Upload a .psa, .plm, or legacy JSON planogram.",
        );
        return;
      }

      router.push("/");
      const result = await importPlanogramFromContent(content);
      setImportReport(result.report);

      if (!result.success) {
        setError(result.message ?? "Import failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid planogram file");
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setFileInput(content);
        setDetectedFormat(detectPlanogramFormat(content, file.name));
        setError(null);
        setImportReport(null);
      } catch (err: unknown) {
        setError(
          "Error reading file: " +
            (err instanceof Error ? err.message : "unknown error"),
        );
      }
    };
    reader.readAsText(file);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      (e.ctrlKey || e.metaKey) &&
      fileInput &&
      !isLoading
    ) {
      handleImport();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-3 flex items-center gap-3">
            <FiFileText className="text-brand" />
            Import Planogram
          </h1>
          <p className="text-gray-600 text-lg">
            Import industry-standard <strong>.psa</strong> or <strong>.plm</strong>{" "}
            planograms, or migrate legacy JSON layouts into the 3D builder.
          </p>
        </div>

        <div className="mb-6 bg-white rounded-2xl p-6 shadow-lg">
          <label className="block text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FiUpload className="text-brand" />
            Upload planogram file:
          </label>
          <input
            type="file"
            accept=".psa,.plm,.json,application/json,text/plain"
            onChange={handleFileUpload}
            className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-brand transition-colors cursor-pointer text-base"
          />
          {detectedFormat && (
            <p className="mt-3 text-sm text-gray-600">
              Detected format:{" "}
              <span className="font-mono uppercase font-semibold text-brand">
                {detectedFormat}
              </span>
            </p>
          )}
        </div>

        <div className="mb-6 bg-white rounded-2xl p-6 shadow-lg">
          <label className="block text-lg font-semibold text-gray-700 mb-4">
            Or paste file contents:
          </label>
          <textarea
            value={fileInput}
            onChange={(e) => {
              setFileInput(e.target.value);
              setDetectedFormat(
                e.target.value.trim()
                  ? detectPlanogramFormat(e.target.value)
                  : null,
              );
            }}
            onKeyDown={handleKeyPress}
            placeholder="Paste .psa, .plm, or legacy JSON… (Ctrl+Enter to import)"
            className="w-full min-h-[300px] max-h-[500px] p-4 font-mono text-sm border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent resize-y"
          />
        </div>

        {isLoading && (
          <div className="mb-6 bg-brand/10 border-2 border-brand/20 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin text-2xl">⏳</div>
                <div className="text-xl font-bold text-brand">
                  Building planogram…
                </div>
              </div>
            </div>
            <div className="w-full h-8 bg-brand/15 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-brand to-brand-dark transition-all duration-300 flex items-center justify-end pr-3"
                style={{ width: `${progress}%` }}
              >
                <span className="text-white font-bold text-sm">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-5 flex items-start gap-3 shadow-lg">
            <FiAlertCircle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800 mb-1">Error</div>
              <div className="text-red-700">{error}</div>
            </div>
          </div>
        )}

        {importReport && !isLoading && (
          <div className="mb-6">
            <PlanogramImportReport report={importReport} />
          </div>
        )}

        <div className="sticky bottom-6 bg-white rounded-2xl p-6 shadow-xl border-2 border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={!fileInput.trim() || isLoading}
              className={`flex-1 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg ${
                !fileInput.trim() || isLoading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-brand to-brand-dark text-white hover:from-brand-dark hover:to-[#152942] hover:shadow-xl hover:scale-[1.02]"
              }`}
            >
              {isLoading ? "Importing…" : "Import & render"}
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-8 py-4 bg-gray-500 text-white rounded-xl text-lg font-semibold hover:bg-gray-600 transition-all shadow-lg hover:shadow-xl"
            >
              <FiX className="inline mr-2" />
              Cancel
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FiCheckCircle className="text-green-500" />
            Supported formats
          </h3>
          <div className="prose prose-sm max-w-none">
            <ul className="space-y-3 text-gray-700 leading-relaxed">
              <li>
                <strong className="text-gray-900">.plm</strong> — Planogram Layout
                Model (JSON). Full round-trip for fixtures, shelves, bins,
                products, facings, and positions.
              </li>
              <li>
                <strong className="text-gray-900">.psa</strong> — JDA Space
                Planning compatible interchange (tab-delimited). Maps fixtures,
                segments, shelves, bins, product catalog, and facings.
              </li>
              <li>
                <strong className="text-gray-900">Legacy JSON</strong> — Older
                generation-blueprint layouts with <code>layout.racks[]</code> are
                migrated automatically.
              </li>
              <li>
                On import, unresolved products, fixture types, or missing shelves
                are reported in the import summary.
              </li>
              <li>
                Export from the rack action bar (single rack) or Scene &amp; store
                menu (full store) as .psa or .plm.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
