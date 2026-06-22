
let selectedRow;
let allTabsSorted;

const tbody = document.querySelector('#tabs_table tbody');
const container = document.getElementById('tabs_table__container');
const searchInput = document.getElementById('search_input');

async function reloadTabs(query) {
	if (allTabsSorted === undefined) {
		allTabsSorted = await browser.runtime.sendMessage({type: 'get-tabs'});
	}

	let tabs = allTabsSorted;
	if (query) {
		tabs = tabs.filter(tabsFilter(query));
	}

	const frag = document.createDocumentFragment();
	tabs.forEach((tab, tabIndex) => {
		const tr = document.createElement('tr');
		tr.dataset.index = tabIndex;
		tr.dataset.tabId = tab.id;

		const iconTd = document.createElement('td');
		if (tab.favIconUrl) {
			const img = document.createElement('img');
			img.width = 16;
			img.height = 16;
			img.loading = 'lazy';
			img.src = !tab.incognito ? tab.favIconUrl : '/icons/mask16.svg';
			iconTd.appendChild(img);
		}

		const titleTd = document.createElement('td');
		titleTd.textContent = tab.title || '';

		const urlTd = document.createElement('td');
		urlTd.textContent = tab.url || '';

		tr.append(iconTd, titleTd, urlTd);
		frag.appendChild(tr);
	});

	tbody.textContent = '';
	tbody.appendChild(frag);

	setSelectedString(0);
}

function tabsFilter(query) {
	const patterns = query.toLowerCase().split(" ");
	return tab => patterns.every(
		pattern => (tab.url || '').toLowerCase().indexOf(pattern) !== -1
			|| (tab.title || '').toLowerCase().indexOf(pattern) !== -1);
}

tbody.addEventListener('click', e => {
	const tr = e.target.closest('tr');
	if (tr) setSelectedString(Number(tr.dataset.index));
});
tbody.addEventListener('dblclick', e => {
	if (e.target.closest('tr')) activateTab();
});

reloadTabs().then(() => searchInput.focus());

searchInput.addEventListener('input', e => reloadTabs(e.target.value));

window.addEventListener('keydown', event => {
	const key = event.key;

	if (key === 'ArrowDown') {
		setSelectedString(getSelectedString() + 1);
		event.preventDefault();
	} else if (key === 'ArrowUp') {
		setSelectedString(getSelectedString() - 1);
		event.preventDefault();
	} else if (key === 'PageDown') {
		setSelectedString(Math.min(getSelectedString() + 13, getTableSize() - 1));
		event.preventDefault();
	} else if (key === 'PageUp') {
		setSelectedString(Math.max(getSelectedString() - 13, 0));
		event.preventDefault();
	} else if (key === 'Escape') {
		browser.windows.remove(browser.windows.WINDOW_ID_CURRENT);
	} else if (key === 'Enter') {
		activateTab();
	} else if (key === 'Delete') {
		closeSelectedTab();
		event.preventDefault();
	}
});

async function closeSelectedTab() {
	if (!selectedRow) {
		return;
	}

	const tabId = Number(selectedRow.dataset.tabId);
	const index = getSelectedString();

	await browser.tabs.remove(tabId);
	allTabsSorted = allTabsSorted.filter(tab => tab.id !== tabId);

	reloadTabs(searchInput.value);
	setSelectedString(Math.min(index, getTableSize() - 1));
}

function setSelectedString(index) {
	const newSelected = tbody.children[index];
	if (!newSelected || index < 0) {
		return;
	}

	if (selectedRow) {
		selectedRow.classList.remove('tabs_table__selected');
	}

	newSelected.classList.add('tabs_table__selected');

	selectedRow = newSelected;

	const stringOffset = selectedRow.offsetTop;
	const scrollMax = stringOffset - 20;
	const scrollMin = stringOffset + selectedRow.offsetHeight - container.clientHeight + 20;

	const scrollValue = Math.max(scrollMin,
		Math.min(scrollMax, container.scrollTop));
	container.scrollTop = scrollValue;
}

function getTableSize() {
	return tbody.children.length;
}

function getSelectedString() {
	return selectedRow ? Number(selectedRow.dataset.index) : undefined;
}

async function activateTab() {
	if (!selectedRow) {
		return;
	}

	const tabId = Number(selectedRow.dataset.tabId);

	await browser.tabs.update(tabId, {active: true});

	const tab = await browser.tabs.get(tabId);
	await browser.windows.update(tab.windowId, {focused: true});
}
