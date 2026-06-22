// ==UserScript==
// @name            Fast Tab Switcher
// @include         main
// ==/UserScript==

// NOTE: disable or remove the Alt+X shortcut from the WebExtension so it
// doesn't conflict.

(function fts() {
	'use strict';

	const doc = window.document;
	const FTS_SHORTCUT = { key: 'x', alt: true,  ctrl: false, shift: false };
	const MGR_SHORTCUT = { key: ' ', alt: false, ctrl: true,  shift: false };

	// ── Styles ─────────────────────────────────────────────────────────

	const style = doc.createElement('style');
	style.textContent = `
		#fts-overlay, #ucm-overlay {
			display: none;
			position: fixed;
			inset: 0;
			z-index: 2147483647;
			background: rgba(0, 0, 0, 0.55);
			align-items: center;
			justify-content: center;
		}
		#fts-overlay.open, #ucm-overlay.open { display: flex; }

		#fts-box {
			width: 1000px;
			height: 500px;
			display: flex;
			flex-direction: column;
			background: #040c10;
			color: #e1e1e1;
			font-family: "Segoe UI", sans-serif;
			font-size: 12px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.8);
			border: 2px solid #3c2711;
			border-radius: 5px;
		}

		#fts-search {
			flex: 0 0 auto;
			appearance: none;
			-moz-appearance: none;
			border: none;
			outline: none;
			background: #040c10;
			color: #ffcf8a;
			font-family: inherit;
			font-size: 13px;
			padding: 3px 6px;
		}

		#fts-scroll {
			flex: 1;
			overflow-y: scroll;
		}

		#fts-table {
			width: 100%;
			table-layout: fixed;
			border-collapse: collapse;
			white-space: nowrap;
			font-size: 13px;
		}

		#fts-table td {
			overflow: hidden;
			text-overflow: ellipsis;
			padding: 4px 0;
			cursor: default;
			user-select: none;
		}

		#fts-table td:nth-child(1) { width: 16px; padding-left: 7px; padding-right: 7px; }
		#fts-table td:nth-child(1) img { width: 16px; height: 16px; display: block; }
		#fts-table td:nth-child(1):empty::before {
			content: '';
			display: block;
			width: 16px;
			height: 16px;
			border-radius: 3px;
			background: #393939;
		}
		#fts-table td:nth-child(2) { width: 50%; }

		#fts-table tr.sel {
			background: #3c2711;
			color: #ffcf8a;
			text-shadow: 0 0 2px #000, 0 0 1px #000;
		}

		#ucm-box {
			width: 480px;
			background: #040c10;
			color: #e1e1e1;
			font-family: "Segoe UI", sans-serif;
			font-size: 13px;
			border: 2px solid #3c2711;
			border-radius: 5px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.8);
			padding: 6px 0;
		}
		.ucm-row {
			display: flex;
			align-items: center;
			padding: 5px 10px;
			cursor: default;
			user-select: none;
			gap: 8px;
		}
		.ucm-row:hover { background: #3c2711; color: #ffcf8a; }
		.ucm-check { width: 14px; flex-shrink: 0; color: #ffcf8a; text-align: center; }
		.ucm-key   { width: 14px; flex-shrink: 0; color: #555; font-size: 11px; text-align: center; }
		.ucm-name  { flex: 1; }
		.ucm-reload {
			font-size: 11px;
			color: #888;
			padding: 1px 6px;
			border: 1px solid #333;
			border-radius: 3px;
		}
		.ucm-row:hover .ucm-reload { border-color: #7a4a1e; color: #ffcf8a; }
		.ucm-sep { border: none; border-top: 1px solid #1e1208; margin: 5px 0; }
		.ucm-dim { color: #888; }
	`;
	doc.head.appendChild(style);

	// ── FTS DOM ────────────────────────────────────────────────────────

	const overlay = doc.createElement('div');
	overlay.id = 'fts-overlay';

	const box = doc.createElement('div');
	box.id = 'fts-box';

	const searchEl = doc.createElement('input');
	searchEl.id = 'fts-search';
	searchEl.setAttribute('autocomplete', 'off');
	searchEl.setAttribute('spellcheck', 'false');

	const scrollEl = doc.createElement('div');
	scrollEl.id = 'fts-scroll';

	const table = doc.createElement('table');
	table.id = 'fts-table';
	const tbody = doc.createElement('tbody');
	tbody.id = 'fts-tbody';
	table.appendChild(tbody);
	scrollEl.appendChild(table);
	box.append(searchEl, scrollEl);
	overlay.appendChild(box);
	doc.documentElement.appendChild(overlay);

	// ── Manager DOM ────────────────────────────────────────────────────

	const ucmOverlay = doc.createElement('div');
	ucmOverlay.id = 'ucm-overlay';
	const ucmBox = doc.createElement('div');
	ucmBox.id = 'ucm-box';
	ucmOverlay.appendChild(ucmBox);
	doc.documentElement.appendChild(ucmOverlay);

	// ── FTS State ──────────────────────────────────────────────────────

	let allTabs   = [];
	let shownTabs = [];
	let selIndex  = 0;

	let mgrReloadMap = new Map();

	// ── Tab collection ─────────────────────────────────────────────────

	function collectTabs() {
		const activeTab = window.gBrowser.selectedTab;
		const result = [];
		const wins = Services.wm.getEnumerator('navigator:browser');
		while (wins.hasMoreElements()) {
			const w = wins.getNext();
			if (w.closed) continue;
			for (const tab of w.gBrowser.tabs) {
				if (tab === activeTab || tab.hidden) continue;
				result.push({
					_tab: tab,
					_win: w,
					title:        tab.label || '',
					url:          tab.linkedBrowser?.currentURI?.spec || '',
					favicon:      tab.image || '',
					lastAccessed: tab.lastAccessed || 0,
				});
			}
		}
		return result.sort((a, b) => b.lastAccessed - a.lastAccessed);
	}

	// ── FTS Render ─────────────────────────────────────────────────────

	function render(query) {
		if (query) {
			const patterns = query.toLowerCase().split(/\s+/).filter(Boolean);
			shownTabs = allTabs.filter(t =>
				patterns.every(p =>
					t.title.toLowerCase().includes(p) ||
					t.url.toLowerCase().includes(p)
				)
			);
		} else {
			shownTabs = allTabs;
		}

		const frag = doc.createDocumentFragment();
		for (const t of shownTabs) {
			const tr = doc.createElement('tr');
			const iconTd = doc.createElement('td');
			if (t.favicon && !t.favicon.startsWith('chrome://')) {
				const img = doc.createElement('img');
				img.src = t.favicon;
				iconTd.appendChild(img);
			}
			const titleTd = doc.createElement('td');
			titleTd.textContent = t.title;
			const urlTd = doc.createElement('td');
			urlTd.textContent = t.url;
			tr.append(iconTd, titleTd, urlTd);
			frag.appendChild(tr);
		}
		tbody.textContent = '';
		tbody.appendChild(frag);
		select(0);
	}

	function select(i) {
		selIndex = Math.max(0, Math.min(i, shownTabs.length - 1));
		for (const tr of tbody.rows) tr.classList.remove('sel');
		const row = tbody.rows[selIndex];
		if (!row) return;
		row.classList.add('sel');
		const rTop = row.offsetTop;
		const rBot = rTop + row.offsetHeight;
		if (rBot > scrollEl.scrollTop + scrollEl.clientHeight)
			scrollEl.scrollTop = rBot - scrollEl.clientHeight;
		else if (rTop < scrollEl.scrollTop)
			scrollEl.scrollTop = rTop;
	}

	// ── FTS Open / Close ───────────────────────────────────────────────

	function ftsOpen() {
		allTabs = collectTabs();
		searchEl.value = '';
		render('');
		overlay.classList.add('open');
		searchEl.focus();
	}

	function ftsClose() {
		overlay.classList.remove('open');
	}

	// ── FTS Actions ────────────────────────────────────────────────────

	function activate() {
		const t = shownTabs[selIndex];
		if (!t) return;
		ftsClose();
		t._win.focus();
		t._win.gBrowser.selectedTab = t._tab;
	}

	function closeTab() {
		const t = shownTabs[selIndex];
		if (!t) return;
		const savedIndex = selIndex;
		t._win.gBrowser.removeTab(t._tab);
		allTabs = allTabs.filter(x => x !== t);
		render(searchEl.value);
		select(Math.min(savedIndex, shownTabs.length - 1));
	}

	// ── Manager Open / Close ───────────────────────────────────────────

	function mgrOpen() {
		ucmBox.textContent = '';

		const scripts = Object.values(_uc.scripts)
			.filter(s => s.filename !== _uc.ALWAYSEXECUTE)
			.sort((a, b) => (a.name || a.filename).localeCompare(b.name || b.filename));

		mgrReloadMap.clear();
		for (const [i, script] of scripts.entries()) {
			const row = doc.createElement('div');
			row.className = 'ucm-row';

			const shortcutKey = i < 36 ? (i < 10 ? String(i) : String.fromCharCode(87 + i)) : '';
			// 0-9 → '0'..'9', 10-35 → 'a'..'z'

			const keyEl = doc.createElement('span');
			keyEl.className = 'ucm-key';
			keyEl.textContent = shortcutKey;

			const check = doc.createElement('span');
			check.className = 'ucm-check';
			check.textContent = script.isEnabled ? '✓' : '';

			const name = doc.createElement('span');
			name.className = 'ucm-name';
			name.textContent = script.name || script.filename;

			const doReload = () => {
				script.isRunning = false;
				_uc.loadScript(script, window);
				mgrClose();
			};

			if (shortcutKey) mgrReloadMap.set(shortcutKey, doReload);

			const reload = doc.createElement('span');
			reload.className = 'ucm-reload';
			reload.textContent = 'reload';
			reload.addEventListener('click', (e) => {
				e.stopPropagation();
				doReload();
			});

			row.addEventListener('click', () => {
				const parts = (xPref.get(_uc.PREF_SCRIPTSDISABLED) || '').split(',').filter(Boolean);
				if (script.isEnabled) {
					parts.push(script.filename);
				} else {
					const idx = parts.indexOf(script.filename);
					if (idx !== -1) parts.splice(idx, 1);
				}
				xPref.set(_uc.PREF_SCRIPTSDISABLED, parts.join(','));
				check.textContent = script.isEnabled ? '✓' : '';
			});

			row.append(check, name, reload, keyEl);
			ucmBox.appendChild(row);
		}

		const hr = doc.createElement('hr');
		hr.className = 'ucm-sep';
		ucmBox.appendChild(hr);

		const restartRow = doc.createElement('div');
		restartRow.className = 'ucm-row ucm-dim';
		restartRow.textContent = 'Restart Firefox (clear cache)';
		restartRow.addEventListener('click', () => {
			Services.appinfo.invalidateCachesOnRestart();
			Services.startup.quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
		});
		ucmBox.appendChild(restartRow);

		ucmOverlay.classList.add('open');
	}

	function mgrClose() {
		ucmOverlay.classList.remove('open');
	}

	// ── FTS Events ─────────────────────────────────────────────────────

	searchEl.addEventListener('input', e => render(e.target.value));

	tbody.addEventListener('click', e => {
		const tr = e.target.closest('tr');
		if (tr) select(tr.rowIndex);
	});
	tbody.addEventListener('dblclick', e => {
		if (e.target.closest('tr')) activate();
	});

	overlay.addEventListener('keydown', e => {
		switch (e.key) {
			case 'ArrowDown': select(selIndex + 1);                       e.preventDefault(); break;
			case 'ArrowUp':   select(selIndex - 1);                       e.preventDefault(); break;
			case 'PageDown':  select(selIndex + 13);                      e.preventDefault(); break;
			case 'PageUp':    select(Math.max(0, selIndex - 13));         e.preventDefault(); break;
			case 'Enter':     activate();                                                      break;
			case 'Escape':    ftsClose();                                                      break;
			case 'Delete':
				if (e.ctrlKey) {
					Services.appinfo.invalidateCachesOnRestart();
					Services.startup.quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
				} else {
					closeTab();
				}
				e.preventDefault();
				break;
		}
	});

	overlay.addEventListener('mousedown', e => {
		if (e.target === overlay) ftsClose();
	});

	// ── Manager Events ─────────────────────────────────────────────────

	ucmOverlay.addEventListener('mousedown', e => {
		if (e.target === ucmOverlay) mgrClose();
	});
	ucmOverlay.addEventListener('keydown', e => {
		if (e.key === 'Escape') mgrClose();
	});

	// ── Global Shortcuts ───────────────────────────────────────────────

	window.addEventListener('keydown', e => {
		if (e.key === 'Escape') {
			if (overlay.classList.contains('open'))    { ftsClose(); e.preventDefault(); }
			if (ucmOverlay.classList.contains('open')) { mgrClose(); e.preventDefault(); }
			return;
		}

		const k = e.key === ' ' ? ' ' : e.key.toLowerCase();

		if (k === FTS_SHORTCUT.key &&
			e.altKey   === FTS_SHORTCUT.alt  &&
			e.ctrlKey  === FTS_SHORTCUT.ctrl &&
			e.shiftKey === FTS_SHORTCUT.shift)
		{
			e.preventDefault();
			e.stopPropagation();
			overlay.classList.contains('open') ? ftsClose() : ftsOpen();
			return;
		}

		if (k === MGR_SHORTCUT.key &&
			e.altKey   === MGR_SHORTCUT.alt  &&
			e.ctrlKey  === MGR_SHORTCUT.ctrl &&
			e.shiftKey === MGR_SHORTCUT.shift)
		{
			e.preventDefault();
			e.stopPropagation();
			if (overlay.classList.contains('open')) ftsClose();
			ucmOverlay.classList.contains('open') ? mgrClose() : mgrOpen();
			return;
		}

		if (ucmOverlay.classList.contains('open') && !e.altKey && !e.ctrlKey && !e.metaKey) {
			const fn = mgrReloadMap.get(k);
			if (fn) { e.preventDefault(); e.stopPropagation(); fn(); }
		}
	}, true);
})();
