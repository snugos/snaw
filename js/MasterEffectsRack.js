// js/MasterEffectsRack.js - Master Effects Rack UI with drag-to-reorder
//
// Feature: Drag-to-Reorder Master FX - A dockable Master Effects Rack window
// that lists the current master bus effects and lets the user:
//   - Add new master effects from a dropdown of available types
//   - Remove existing master effects (trash button)
//   - Bypass a master effect (toggle button, wet=0 vs wet=1)
//   - Reorder effects via drag-and-drop (the headline feature)
//   - Click an effect to edit its parameters (slider/knob/select)
//
// State is read from `appServices.getMasterEffectsState()`. All mutations go
// through `appServices.addMasterEffect / removeMasterEffect /
// updateMasterEffectParam / toggleMasterEffectBypass / reorderMasterEffect`
// so that audio.js + state.js stay as the single source of truth.

const PANEL_ID = 'masterEffectsRack';
const PANEL_TITLE = 'Master Effects Rack';
const MER_VERSION = '0.1.0';

let localAppServices = {};
let _panelWindow = null;
let _isPanelOpen = false;
let _selectedEffectId = null;
let _draggedEffectId = null;
let _draggedFromIndex = -1;
let _dragDepth = 0;

export function initMasterEffectsRack(services) {
    localAppServices = services || {};
    console.log(`[MasterEffectsRack v${MER_VERSION}] Initialized`);
}

export function getMasterEffectsRackVersion() { return MER_VERSION; }
export function isMasterEffectsRackOpen() { return _isPanelOpen; }

function _safe(fnName) {
    const fn = localAppServices && localAppServices[fnName];
    return typeof fn === 'function' ? fn : null;
}

function _showNotif(msg, dur) {
    const fn = _safe('showNotification');
    if (fn) fn(msg, dur || 1800);
}

function _getMasterEffects() {
    const fn = _safe('getMasterEffectsState');
    if (!fn) return [];
    const arr = fn();
    return Array.isArray(arr) ? arr : [];
}

function _getEffectDefs() {
    const reg = _safe('effectsRegistryAccess');
    const defs = reg && reg.AVAILABLE_EFFECTS;
    return defs || {};
}

function _getEffectDisplayName(effectType) {
    const defs = _getEffectDefs();
    if (defs[effectType] && defs[effectType].displayName) {
        return defs[effectType].displayName;
    }
    return effectType;
}

function _getEffectParamDefs(effectType) {
    const reg = _safe('effectsRegistryAccess');
    const fn = reg && reg.getEffectParamDefinitions;
    if (typeof fn === 'function') {
        try { return fn(effectType) || []; } catch (e) { return []; }
    }
    const defs = _getEffectDefs();
    if (defs[effectType]) return defs[effectType].params || [];
    return [];
}

function _isEffectBypassed(effectWrapper) {
    if (!effectWrapper) return false;
    if (effectWrapper.bypassed === true) return true;
    const wet = effectWrapper.params && effectWrapper.params.wet;
    if (typeof wet === 'number' && wet === 0) return true;
    return false;
}

function _readNestedValue(obj, key) {
    if (!obj) return undefined;
    const keys = key.split('.');
    let cur = obj;
    for (const k of keys) {
        if (cur === null || cur === undefined) return undefined;
        cur = cur[k];
    }
    return cur;
}

function _renderPanelBody(container) {
    const effects = _getMasterEffects();
    const effectDefs = _getEffectDefs();
    const selected = effects.find(e => e.id === _selectedEffectId);

    const sortedDefs = Object.keys(effectDefs)
        .map(k => ({ key: k, displayName: effectDefs[k].displayName || k }))
        .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));

    container.innerHTML = `
        <div class="h-full flex flex-col bg-gray-900 text-white">
            <div class="p-3 border-b border-gray-700 flex items-center gap-2">
                <label for="mer-add-select" class="text-xs text-gray-400 whitespace-nowrap">Add:</label>
                <select id="mer-add-select" class="flex-1 text-xs bg-gray-800 border border-gray-600 text-white rounded px-2 py-1">
                    <option value="">-- Select effect --</option>
                    ${sortedDefs.map(d => `<option value="${d.key}">${d.displayName}</option>`).join('')}
                </select>
                <button id="mer-add-btn" class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white">Add</button>
            </div>

            <div class="px-3 py-1 text-[10px] text-gray-500 border-b border-gray-700 flex items-center justify-between">
                <span>Drag the <span class="font-mono">⋮⋮</span> handle to reorder. Click an effect to edit.</span>
                <span>${effects.length} effect${effects.length === 1 ? '' : 's'}</span>
            </div>

            <div id="mer-list" class="flex-1 overflow-y-auto p-2 space-y-1">
                ${effects.length === 0
                    ? '<div class="text-xs text-gray-500 italic p-4 text-center">No master effects yet. Pick one above and click Add.</div>'
                    : effects.map((e, idx) => _renderEffectRow(e, idx, effects.length)).join('')
                }
            </div>

            <div id="mer-controls" class="border-t border-gray-700 p-3 bg-gray-800" style="max-height: 45%; overflow-y: auto;">
                ${selected ? _renderEffectControls(selected) : '<div class="text-xs text-gray-500 italic">Click an effect above to edit its parameters.</div>'}
            </div>
        </div>
    `;

    _wireListEvents(container, effects);
}

function _renderEffectRow(effectWrapper, idx, total) {
    const displayName = _getEffectDisplayName(effectWrapper.type);
    const isBypassed = _isEffectBypassed(effectWrapper);
    const isSelected = effectWrapper.id === _selectedEffectId;
    return `
        <div class="mer-row flex items-center gap-2 p-2 rounded border ${isSelected ? 'border-blue-500 bg-gray-700' : 'border-gray-700 bg-gray-800 hover:bg-gray-750'}"
             data-effect-id="${effectWrapper.id}"
             data-index="${idx}">
            <span class="mer-drag-handle text-gray-500 hover:text-gray-300 cursor-grab select-none px-1 text-base leading-none" draggable="true" title="Drag to reorder">⋮⋮</span>
            <span class="flex-1 text-sm cursor-pointer ${isBypassed ? 'line-through text-gray-500' : 'text-white'}" data-role="select">
                ${idx + 1}. ${displayName}
            </span>
            <button class="mer-bypass-btn text-[10px] px-2 py-0.5 rounded ${isBypassed ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'}"
                    title="${isBypassed ? 'Re-enable this effect' : 'Bypass this effect'}">
                ${isBypassed ? 'BYP' : 'ON'}
            </button>
            <button class="mer-remove-btn text-[10px] px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white"
                    title="Remove this effect from the master chain">
                ✕
            </button>
        </div>
    `;
}

function _renderEffectControls(effectWrapper) {
    const displayName = _getEffectDisplayName(effectWrapper.type);
    const paramDefs = _getEffectParamDefs(effectWrapper.type);
    const params = effectWrapper.params || {};

    if (!paramDefs || paramDefs.length === 0) {
        return `
            <div>
                <div class="text-xs font-semibold text-gray-300 mb-2">${displayName}</div>
                <div class="text-xs text-gray-500 italic">No editable parameters.</div>
            </div>
        `;
    }

    return `
        <div>
            <div class="flex items-center justify-between mb-2">
                <div class="text-xs font-semibold text-gray-300">${displayName}</div>
                <div class="text-[10px] text-gray-500 font-mono">${effectWrapper.id}</div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                ${paramDefs.map(pDef => _renderParamControl(pDef, params)).join('')}
            </div>
        </div>
    `;
}

function _renderParamControl(pDef, params) {
    const currentValue = _readNestedValue(params, pDef.key);
    const defVal = pDef.defaultValue !== undefined ? pDef.defaultValue : '';
    const val = currentValue !== undefined ? currentValue : defVal;

    if (pDef.type === 'select') {
        const opts = Array.isArray(pDef.options) ? pDef.options : [];
        return `
            <div class="flex flex-col gap-1">
                <label class="text-[10px] text-gray-400">${pDef.label || pDef.key}</label>
                <select class="mer-param text-xs bg-gray-900 border border-gray-600 text-white rounded px-1 py-0.5"
                        data-param-key="${pDef.key}" data-param-type="select">
                    ${opts.map(o => `<option value="${o}" ${String(val) === String(o) ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
            </div>
        `;
    }

    if (pDef.type === 'checkbox') {
        return `
            <div class="flex items-center gap-2 col-span-2">
                <input type="checkbox" class="mer-param" data-param-key="${pDef.key}" data-param-type="checkbox" ${val ? 'checked' : ''} />
                <label class="text-[10px] text-gray-400">${pDef.label || pDef.key}</label>
            </div>
        `;
    }

    const min = pDef.min !== undefined ? pDef.min : 0;
    const max = pDef.max !== undefined ? pDef.max : 1;
    const step = pDef.step !== undefined ? pDef.step : 0.01;
    const decimals = pDef.decimals !== undefined ? pDef.decimals : 2;
    const suffix = pDef.displaySuffix || '';
    const num = Number(val);
    const display = Number.isFinite(num) ? num.toFixed(decimals) : '—';
    return `
        <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
                <label class="text-[10px] text-gray-400">${pDef.label || pDef.key}</label>
                <span class="mer-param-readout text-[10px] text-cyan-300 font-mono">${display}${suffix}</span>
            </div>
            <input type="range" class="mer-param w-full accent-cyan-400"
                   data-param-key="${pDef.key}" data-param-type="range"
                   data-decimals="${decimals}" data-suffix="${suffix}"
                   min="${min}" max="${max}" step="${step}" value="${num}" />
        </div>
    `;
}

function _wireListEvents(container, effects) {
    const addBtn = container.querySelector('#mer-add-btn');
    const addSelect = container.querySelector('#mer-add-select');
    if (addBtn && addSelect) {
        addBtn.addEventListener('click', () => {
            const type = addSelect.value;
            if (!type) {
                _showNotif('Pick an effect from the dropdown first', 1500);
                return;
            }
            _addEffect(type);
        });
    }

    container.querySelectorAll('.mer-row').forEach(row => {
        const effectId = row.dataset.effectId;

        const selectArea = row.querySelector('[data-role="select"]');
        if (selectArea) {
            selectArea.addEventListener('click', (e) => {
                e.stopPropagation();
                _selectedEffectId = effectId;
                _renderPanelBody(container);
            });
        }

        const removeBtn = row.querySelector('.mer-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _removeEffect(effectId);
            });
        }

        const bypassBtn = row.querySelector('.mer-bypass-btn');
        if (bypassBtn) {
            bypassBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _toggleBypass(effectId);
            });
        }

        const handle = row.querySelector('.mer-drag-handle');
        if (handle) {
            handle.addEventListener('dragstart', (e) => _onDragStart(e, effectId, container));
            handle.addEventListener('dragend', (e) => _onDragEnd(e, container));
        }

        row.addEventListener('dragover', (e) => _onDragOver(e, effectId, container));
        row.addEventListener('dragleave', (e) => _onDragLeave(e, effectId, container));
        row.addEventListener('drop', (e) => _onDrop(e, effectId, container));
    });

    container.querySelectorAll('.mer-param').forEach(input => {
        const key = input.dataset.paramKey;
        const type = input.dataset.paramType;
        const decimals = parseInt(input.dataset.decimals || '2', 10);
        const suffix = input.dataset.suffix || '';

        const onChange = () => {
            let value;
            if (type === 'checkbox') value = input.checked;
            else if (type === 'range') value = parseFloat(input.value);
            else value = input.value;

            _updateParam(_selectedEffectId, key, value);

            if (type === 'range') {
                const readout = input.parentElement && input.parentElement.querySelector('.mer-param-readout');
                if (readout) readout.textContent = `${Number(value).toFixed(decimals)}${suffix}`;
            }
        };

        input.addEventListener('input', onChange);
        input.addEventListener('change', onChange);
    });
}

function _onDragStart(e, effectId, container) {
    const row = container.querySelector(`.mer-row[data-effect-id="${effectId}"]`);
    if (!row) { e.preventDefault(); return; }
    _draggedEffectId = effectId;
    _draggedFromIndex = parseInt(row.dataset.index, 10);
    try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', effectId);
    } catch (err) { /* some browsers throw on setData in sandboxed iframes */ }
    row.classList.add('opacity-50', 'border-blue-400');
    // CSS :active doesn't fire during HTML5 drag, so toggle .mer-dragging on the
    // handle to switch the cursor to `grabbing` while a drag is in flight.
    const handle = row.querySelector('.mer-drag-handle');
    if (handle) handle.classList.add('mer-dragging');
    _dragDepth = 0;
}

function _onDragEnd(e, container) {
    if (_draggedEffectId) {
        const row = container.querySelector(`.mer-row[data-effect-id="${_draggedEffectId}"]`);
        if (row) {
            row.classList.remove('opacity-50', 'border-blue-400');
            // Clear the dragging cursor on the handle so it goes back to `grab`.
            const handle = row.querySelector('.mer-drag-handle');
            if (handle) handle.classList.remove('mer-dragging');
        }
    }
    container.querySelectorAll('.mer-drop-before, .mer-drop-after').forEach(el => {
        el.classList.remove('mer-drop-before', 'mer-drop-after');
    });
    _draggedEffectId = null;
    _draggedFromIndex = -1;
    _dragDepth = 0;
}

function _onDragOver(e, effectId, container) {
    if (!_draggedEffectId || effectId === _draggedEffectId) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }

    const row = container.querySelector(`.mer-row[data-effect-id="${effectId}"]`);
    if (!row) return;

    const rect = row.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;

    container.querySelectorAll('.mer-drop-before, .mer-drop-after').forEach(el => {
        el.classList.remove('mer-drop-before', 'mer-drop-after');
    });

    if (insertBefore) row.classList.add('mer-drop-before');
    else row.classList.add('mer-drop-after');

    _dragDepth = insertBefore ? -1 : 1;
}

function _onDragLeave(e, effectId, container) {
    const row = container.querySelector(`.mer-row[data-effect-id="${effectId}"]`);
    if (row && (!e.relatedTarget || !row.contains(e.relatedTarget))) {
        row.classList.remove('mer-drop-before', 'mer-drop-after');
    }
}

function _onDrop(e, effectId, container) {
    e.preventDefault();
    if (!_draggedEffectId || effectId === _draggedEffectId) {
        _onDragEnd(e, container);
        return;
    }
    const effects = _getMasterEffects();
    const targetIndex = effects.findIndex(eff => eff.id === effectId);
    if (targetIndex < 0) { _onDragEnd(e, container); return; }

    let newIndex = _dragDepth < 0 ? targetIndex : targetIndex + 1;

    const fromIndex = effects.findIndex(eff => eff.id === _draggedEffectId);
    if (fromIndex >= 0 && fromIndex < newIndex) newIndex -= 1;

    _onDragEnd(e, container);
    _reorderEffect(_draggedEffectId, newIndex);
}

function _addEffect(effectType) {
    const fn = _safe('addMasterEffect');
    if (fn) {
        try {
            fn(effectType);
            _showNotif(`Added ${_getEffectDisplayName(effectType)} to master`, 1500);
        } catch (err) {
            console.error('[MasterEffectsRack] addMasterEffect failed:', err);
            _showNotif('Failed to add effect', 2000);
        }
    } else {
        console.warn('[MasterEffectsRack] addMasterEffect service not available');
    }
}

function _removeEffect(effectId) {
    const fn = _safe('removeMasterEffect');
    if (fn) {
        try {
            fn(effectId);
            if (_selectedEffectId === effectId) _selectedEffectId = null;
            _showNotif('Removed effect from master', 1500);
        } catch (err) {
            console.error('[MasterEffectsRack] removeMasterEffect failed:', err);
        }
    } else {
        console.warn('[MasterEffectsRack] removeMasterEffect service not available');
    }
}

function _toggleBypass(effectId) {
    const fn = _safe('toggleMasterEffectBypass');
    if (fn) {
        try { fn(effectId); } catch (err) {
            console.error('[MasterEffectsRack] toggleMasterEffectBypass failed:', err);
        }
    } else {
        console.warn('[MasterEffectsRack] toggleMasterEffectBypass service not available');
    }
}

function _reorderEffect(effectId, newIndex) {
    const fn = _safe('reorderMasterEffect');
    if (fn) {
        try {
            fn(effectId, newIndex);
            _showNotif('Master FX reordered', 1200);
        } catch (err) {
            console.error('[MasterEffectsRack] reorderMasterEffect failed:', err);
        }
    } else {
        console.warn('[MasterEffectsRack] reorderMasterEffect service not available');
    }
}

function _updateParam(effectId, paramPath, value) {
    if (!effectId) return;
    const fn = _safe('updateMasterEffectParam');
    if (fn) {
        try { fn(effectId, paramPath, value); } catch (err) {
            console.error('[MasterEffectsRack] updateMasterEffectParam failed:', err);
        }
    }
}

export function renderMasterEffectsRackPanel(container) {
    if (!container) return;
    try {
        _renderPanelBody(container);
    } catch (err) {
        console.warn('[MasterEffectsRack] renderMasterEffectsRackPanel error:', err?.message || err);
    }
}

export function openMasterEffectsRackWindow(winState) {
    if (!localAppServices || typeof localAppServices.createWindow !== 'function') {
        console.warn('[MasterEffectsRack] appServices.createWindow is not available');
        return null;
    }

    if (typeof localAppServices.getOpenWindows === 'function') {
        const openWindows = localAppServices.getOpenWindows();
        const existing = openWindows && openWindows.get && openWindows.get(PANEL_ID);
        if (existing) {
            if (existing.restore) existing.restore();
            const container = existing.element && existing.element.querySelector('#masterEffectsRackContent');
            if (container) _renderPanelBody(container);
            _panelWindow = existing;
            _isPanelOpen = true;
            return existing;
        }
    }

    const container = document.createElement('div');
    container.id = 'masterEffectsRackContent';
    container.className = 'h-full';
    _renderPanelBody(container);

    const options = {
        width: 480,
        height: 560,
        minWidth: 380,
        minHeight: 400,
        closable: true,
        minimizable: true,
        resizable: true,
        initialContentKey: PANEL_ID
    };
    if (winState && typeof winState === 'object') {
        if (typeof winState.x === 'number') options.x = winState.x;
        if (typeof winState.y === 'number') options.y = winState.y;
        if (typeof winState.width === 'number') options.width = winState.width;
        if (typeof winState.height === 'number') options.height = winState.height;
    }

    const win = localAppServices.createWindow(PANEL_ID, PANEL_TITLE, container, options);

    if (win) {
        _panelWindow = win;
        _isPanelOpen = true;
        const origClose = win.close;
        win.close = function () {
            _isPanelOpen = false;
            _panelWindow = null;
            _selectedEffectId = null;
            return origClose ? origClose.apply(this, arguments) : undefined;
        };
    }
    return win;
}