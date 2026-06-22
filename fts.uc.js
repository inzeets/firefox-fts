// ==UserScript==
// @name            Fast Tab Switcher
// @include         main
// ==/UserScript==

// NOTE: disable or remove the Alt+X shortcut from the WebExtension so it
// doesn't conflict.

(function fts() {
	'use strict';

	Cu.reportError('[fts] script starting, location: ' + window.location.href);
	const doc = window.document;
	const SHORTCUT = { key: 'x', alt: true, ctrl: false, shift: false };

	// ── DOM ────────────────────────────────────────────────────────────

	const style = doc.createElement('style');
	style.textContent = `
		#fts-overlay {
			display: none;
			position: fixed;
			inset: 0;
			z-index: 2147483647;
			background: rgba(0, 0, 0, 0.55);
			align-items: center;
			justify-content: center;
		}
		#fts-overlay.open { display: flex; }

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
	`;
	Cu.reportError('[fts] doc.head: ' + doc.head);
	doc.head.appendChild(style);

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

	// ── State ──────────────────────────────────────────────────────────

	let allTabs   = [];
	let shownTabs = [];
	let selIndex  = 0;

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

	// ── Render ─────────────────────────────────────────────────────────

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

	// ── Selection ──────────────────────────────────────────────────────

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

	// ── Open / Close ───────────────────────────────────────────────────

	function open() {
		allTabs = collectTabs();
		searchEl.value = '';
		render('');
		overlay.classList.add('open');
		searchEl.focus();
	}

	function close() {
		overlay.classList.remove('open');
	}

	// ── Actions ────────────────────────────────────────────────────────

	function activate() {
		const t = shownTabs[selIndex];
		if (!t) return;
		close();
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

	// ── Events ─────────────────────────────────────────────────────────

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
			case 'Escape':    close();                                                         break;
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

	// Click on backdrop closes.
	overlay.addEventListener('mousedown', e => {
		if (e.target === overlay) close();
	});

	Cu.reportError('[fts] setup complete, listening for Alt+X');

	// Global shortcut — capture phase fires before the page.
	window.addEventListener('keydown', e => {
		Cu.reportError('[fts] keydown: ' + e.key + ' alt=' + e.altKey);
		if (e.key.toLowerCase() === SHORTCUT.key &&
			e.altKey   === SHORTCUT.alt  &&
			e.ctrlKey  === SHORTCUT.ctrl &&
			e.shiftKey === SHORTCUT.shift)
		{
			e.preventDefault();
			e.stopPropagation();
			overlay.classList.contains('open') ? close() : open();
		}
	}, true);
})();
