
const WIDTH = 1000;
const HEIGHT = 500;

let ftsWindowId = null;
let ftsTabsResolve;
let ftsTabsPromise = new Promise(r => { ftsTabsResolve = r; });
let creationPromise = null;

function main() {
	browser.commands.onCommand.addListener(proceedCommand);
	browser.action.onClicked.addListener(openFtsWindow);
	browser.windows.onFocusChanged.addListener(onFocusChanged);
	browser.windows.onRemoved.addListener(onWindowRemoved);

	browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
		if (msg.type === 'get-tabs') {
			ftsTabsPromise.then(tabs => sendResponse(tabs));
			return true;
		}
	});
}

function proceedCommand(name) {
	if (name === 'open-fts') openFtsWindow();
}

async function openFtsWindow() {
	if (ftsWindowId || creationPromise) return; // already open or opening

	const dpr = window.devicePixelRatio;
	const left = Math.round((screen.availWidth - WIDTH) / 2 * dpr);
	const top  = Math.round((screen.availHeight - HEIGHT) / 2 * dpr);

	ftsTabsPromise = new Promise(r => { ftsTabsResolve = r; });

	// Fetch tabs and create the window in parallel.
	creationPromise = browser.windows.create({
		height: HEIGHT,
		width: WIDTH,
		left,
		top,
		type: 'popup',
		url: browser.runtime.getURL('tab_switcher/switcher.html'),
		allowScriptsToClose: true,
	});

	const [allTabs, win] = await Promise.all([
		browser.tabs.query({ windowType: 'normal' }),
		creationPromise,
	]);

	ftsWindowId = win.id;
	creationPromise = null;
	ftsTabsResolve(sortTabs(allTabs));
}

function sortTabs(tabs) {
	return tabs
		.filter(t => !t.active)
		.sort((a, b) => b.lastAccessed - a.lastAccessed);
}

function onFocusChanged(windowId) {
	if (creationPromise) return;
	if (ftsWindowId && windowId !== ftsWindowId) {
		browser.windows.remove(ftsWindowId);
	}
}

function onWindowRemoved(windowId) {
	if (ftsWindowId === windowId) {
		ftsWindowId = null;
	}
}

main();
