"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanogramStore, type PlanogramState } from "@/store/planogramStore";
import {
  FiUpload,
  FiX,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";

export default function ImportPage() {
  const router = useRouter();
  const loadFromJSON = usePlanogramStore(
    (state: PlanogramState) => state.loadFromJSON,
  );
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setProgress(0);
      const jsonData = JSON.parse(jsonInput);
      // Navigate to canvas immediately so user can see model building
      router.push("/");
      // Start loading in background - progress will be shown on canvas
      await loadFromJSON(jsonData);
    } catch (err: any) {
      setError(err.message || "Invalid JSON format");
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          setJsonInput(content);
          setError(null);
        } catch (err: any) {
          setError("Error reading file: " + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      (e.ctrlKey || e.metaKey) &&
      jsonInput &&
      !isLoading
    ) {
      handleImport();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-3 flex items-center gap-3">
            <FiFileText className="text-blue-500" />
            Import Planogram from JSON
          </h1>
          <p className="text-gray-600 text-lg">
            Upload or paste your planogram JSON data to visualize it in 3D
          </p>
        </div>

        {/* File Upload Section */}
        <div className="mb-6 bg-white rounded-2xl p-6 shadow-lg">
          <label className="block text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FiUpload className="text-blue-500" />
            Upload JSON File:
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 transition-colors cursor-pointer text-base"
            />
          </div>
        </div>

        {/* JSON Input Section */}
        <div className="mb-6 bg-white rounded-2xl p-6 shadow-lg">
          <label className="block text-lg font-semibold text-gray-700 mb-4">
            Or Paste JSON:
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Paste your JSON planogram data here... (Press Ctrl+Enter to import)"
            className="w-full min-h-[300px] max-h-[500px] p-4 font-mono text-sm border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        {/* Loading Progress */}
        {isLoading && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin text-2xl">⏳</div>
                <div className="text-xl font-bold text-blue-700">
                  Building Warehouse Model...
                </div>
              </div>
            </div>
            <div className="w-full h-8 bg-blue-100 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 flex items-center justify-end pr-3"
                style={{ width: `${progress}%` }}
              >
                <span className="text-white font-bold text-sm">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600 italic">
              {progress < 20 && "📦 Parsing racks and sides..."}
              {progress >= 20 &&
                progress < 50 &&
                "🔨 Creating rows and bins..."}
              {progress >= 50 && progress < 80 && "📊 Adding products..."}
              {progress >= 80 && progress < 95 && "✨ Finalizing layout..."}
              {progress >= 95 && "🎉 Almost done!"}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-5 flex items-start gap-3 shadow-lg">
            <FiAlertCircle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800 mb-1">Error</div>
              <div className="text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="sticky bottom-6 bg-white rounded-2xl p-6 shadow-xl border-2 border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={!jsonInput.trim() || isLoading}
              className={`flex-1 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg ${
                !jsonInput.trim() || isLoading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-xl hover:scale-[1.02]"
              }`}
            >
              {isLoading ? "Importing..." : "Import & Render"}
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

        {/* JSON Format Requirements */}
        <div className="mt-8 bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FiCheckCircle className="text-green-500" />
            JSON Format Requirements
          </h3>
          <div className="prose prose-sm max-w-none">
            <ul className="space-y-3 text-gray-700 leading-relaxed">
              <li>
                <strong className="text-gray-900">locationId</strong>: Location
                identifier
              </li>
              <li>
                <strong className="text-gray-900">generationBlueprint</strong>:
                (Optional) Blueprint with direction, expansionStrategy, and
                rackRules
              </li>
              <li>
                <strong className="text-gray-900">
                  generationBlueprint.direction
                </strong>
                : primaryAxis (NORTH_SOUTH/EAST_WEST), leftFacing, rightFacing
              </li>
              <li>
                <strong className="text-gray-900">
                  generationBlueprint.rackRules
                </strong>
                : rackSpacingCm, defaultHeight, rowsPerSide, binsPerRow
              </li>
              <li>
                <strong className="text-gray-900">
                  generationBlueprint.expansionStrategy
                </strong>
                : doubleSidedUntilRack, thenConvertTo
                (&quot;singleSided&quot;/&quot;doubleSided&quot;)
              </li>
              <li>
                <strong className="text-gray-900">
                  generationBlueprint.layoutStyle
                </strong>
                : &quot;single_row&quot; or &quot;double_row_aisle&quot;
                (optional)
              </li>
              <li>
                <strong className="text-gray-900">
                  generationBlueprint.aisleWidthCm
                </strong>
                : Aisle width in cm for double_row_aisle (optional)
              </li>
              <li>
                Rack positions use{" "}
                <strong className="text-gray-900">origin: center</strong>{" "}
                (layout centered at 0,0)
              </li>
              <li>
                <strong className="text-gray-900">layout.racks</strong>: Array
                of racks (sorted by createdDate), each with sides containing
                rows
              </li>
              <li>
                <strong className="text-gray-900">
                  layout.racks[].createdDate
                </strong>
                : ISO date string for chronological ordering
              </li>
              <li>
                <strong className="text-gray-900">
                  layout.racks[].sides[].rows[]
                </strong>
                : Rows containing bins
              </li>
              <li>
                <strong className="text-gray-900">
                  layout.racks[].sides[].rows[].bins[]
                </strong>
                : Bins with bin_id, aisle, merged flag, and products array
              </li>
              <li>
                <strong className="text-gray-900">layout.aisles</strong>: Array
                of aisle definitions with connected_bins
              </li>
              <li>
                <strong className="text-gray-900">products</strong>: Array of
                product IDs (strings like &quot;P001&quot;, &quot;P002&quot;)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
