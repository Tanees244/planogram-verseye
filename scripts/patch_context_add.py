from pathlib import Path

p = Path(r'c:\Projects\planogram-verseye\src\components\ContextAddButton.tsx')
text = p.read_text(encoding='utf-8')

# Area section
start = text.index('  // Area selected')
end = text.index('  // Rack selected')
new_area = r'''  // Area selected - Add Rack
  if (selectedType === "area") {
    return (
      <>
        <div className="flex flex-col gap-2 items-start">
          <ActionBar label="Area selected">
            <ActionBtn
              onClick={() => {
                setAddRackError(null);
                setShowRackModal(true);
              }}
            >
              <span className="text-lg leading-none">+</span> Add Rack
            </ActionBtn>
          </ActionBar>
          {addRackError && (
            <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm max-w-md">
              {addRackError}
            </div>
          )}
        </div>

        <AddRackModal
          open={showRackModal}
          onClose={() => setShowRackModal(false)}
          areaWidth={area.width}
          areaDepth={area.depth}
          form={rackForm}
          onChange={(form) => {
            setRackForm(form);
            const errs = validateRackForm(selectedLocationId, form);
            setRackErrors(errs);
            setIsRackFormValid(Object.keys(errs).length === 0);
          }}
          locations={locations}
          locationsLoading={locationsLoading}
          locationsError={locationsError}
          selectedLocationId={selectedLocationId}
          onLocationChange={(v) => {
            setSelectedLocationId(v);
            setLocationValidationError(null);
            const errs = validateRackForm(v, rackForm);
            setRackErrors(errs);
            setIsRackFormValid(Object.keys(errs).length === 0);
          }}
          errors={{ ...rackErrors, location: rackErrors.location ?? locationValidationError }}
          globalError={addRackError}
          isSubmitting={isAddingRack}
          onSubmit={() => submitRack(undefined)}
          onPlaceOnFloor={placeRackOnFloor}
          submitLabel="Add at center"
        />
      </>
    );
  }

'''
text = text[:start] + new_area + text[end:]

# Rack section - replace row modal
start2 = text.index('        {showRowModal && selectedId && (')
end2 = text.index('  // Row selected')
# find end of showRowModal block - it's before Row selected comment
# Actually end2 points to Row selected - need to go back to find closing of rack section
# Better: replace from showRowModal to end of rack if block

rack_modal_start = text.index('        {showRowModal && selectedId && (')
rack_modal_end = text.index('      </>\n    );\n  }\n\n  // Row selected')

new_row_modal = r'''        <AddRowModal
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

'''
# Fix rack section action bar first
text_before_row = text[:rack_modal_start]
text_after_rack = text[rack_modal_end:]

# Replace action bar in rack section
old_rack_bar = '''        <div className="flex flex-col gap-2 items-start">
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
            </button>'''

new_rack_bar = '''        <div className="flex flex-col gap-2 items-start">
          <ActionBar label="Rack selected">
            <ActionBtn onClick={() => setShowRowModal(true)}>
              <span className="text-lg leading-none">+</span> Add Row
            </ActionBtn>
            <ActionBtn
              variant="secondary"
              onClick={() => {
                setMoveRackError(null);
                setEditingRackId(selectedId);
              }}
            >
              Move Rack
            </ActionBtn>'''

text = text.replace(old_rack_bar, new_rack_bar, 1)

rack_modal_start = text.index('        {showRowModal && selectedId && (')
rack_modal_end = text.index('      </>\n    );\n  }\n\n  // Row selected')
text = text[:rack_modal_start] + new_row_modal.strip() + '\n\n  ' + text[rack_modal_end + len('      </>\n    );\n  }\n\n  '):]

# Row section - bin modal
old_row_bar = '''        <div className={actionBarClass}>
          <span className="text-gray-300 text-sm">Row selected</span>
          <button
            onClick={() => {
              setBinNameInput("");
              setBinNameError(null);
              setShowBinModal(true);
            }}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <span className="text-lg">+</span>
            Add Bin
          </button>'''

new_row_bar = '''        <ActionBar label="Row selected">
          <ActionBtn
            onClick={() => {
              setBinNameInput("");
              setBinNameError(null);
              setShowBinModal(true);
            }}
          >
            <span className="text-lg leading-none">+</span> Add Bin
          </ActionBtn>'''

text = text.replace(old_row_bar, new_row_bar, 1)

bin_modal_start = text.index('        {showBinModal && (')
bin_modal_end = text.index('      </>\n    );\n  }\n\n  // Bin selected')

new_bin_modal = r'''        <AddBinModal
          open={showBinModal}
          onClose={() => !addingBin && setShowBinModal(false)}
          binName={binNameInput}
          onBinNameChange={(v) => { setBinNameInput(v); setBinNameError(null); }}
          error={binNameError}
          isSubmitting={addingBin}
          onSubmit={handleAddBin}
        />
      </>
    );
  }

'''
text = text[:bin_modal_start] + new_bin_modal + text[bin_modal_end + len('      </>\n    );\n  }\n\n  '):]

# Bin section action bar
old_bin_bar = '''        <div className={actionBarClass}>
          <span className="text-gray-300 text-sm">Bin selected</span>
          <button
            onClick={() => setShowProductModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <span className="text-lg">+</span>
            Add Product
          </button>'''

new_bin_bar = '''        <ActionBar label="Bin selected">
          <ActionBtn onClick={() => setShowProductModal(true)}>
            <span className="text-lg leading-none">+</span> Attach Product
          </ActionBtn>'''

text = text.replace(old_bin_bar, new_bin_bar, 1)

# Remove unused actionBarClass and validateRackFormLocal
text = text.replace('  const actionBarClass = ""\n\n', '')
text = text.replace('  const validateRackFormLocal = validateRackForm;\n\n', '')
text = text.replace('validateRackFormLocal', 'validateRackForm')

p.write_text(text, encoding='utf-8')
print('done')
