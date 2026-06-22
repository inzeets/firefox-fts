
let ftsWindowId;
let creating = false;
let ftsTabs;
let ftsTabsResolve;
let ftsTabsPromise = new Promise(r => { ftsTabsResolve = r; });

function main() {
	browser.commands.onCommand.addListener(proceedCommand);
	browser.action.onClicked.addListener(openFtsWindow);

	browser.windows.onFocusChanged.addListener(onFocusChanged);
	browser.windows.onRemoved.addListener(onWindowRemoved);

	browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
		if (msg.type === 'get-tabs') {
			// Respond immediately if ready, or wait for the parallel query to finish.
			ftsTabsPromise.then(tabs => sendResponse(tabs));
			return true; // keep channel open for async response
		}
	});
}

function proceedCommand(name) {
	if (name === 'open-fts') {
		openFtsWindow();
	}
}

async function openFtsWindow() {
	const height = 500;
	const width = 1000;

	// windows.create takes left/top in device pixels but width/height in CSS
	// pixels, so scale the position by devicePixelRatio to center on HiDPI.
	const dpr = window.devicePixelRatio;
	const left = Math.round((screen.availWidth - width) / 2 * dpr);
	const top = Math.round((screen.availHeight - height) / 2 * dpr);

	// Reset the tabs promise for this invocation.
	ftsTabsPromise = new Promise(r => { ftsTabsResolve = r; });

	creating = true;

	// Fetch tabs and create the window in parallel — don't wait for the query
	// before starting the window, so both happen simultaneously.
	const [allTabs, win] = await Promise.all([
		browser.tabs.query({windowType: 'normal'}),
		browser.windows.create({
			height: height,
			width: width,
			left: left,
			top: top,
			type: 'popup',
			url: browser.runtime.getURL('tab_switcher/switcher.html'),
			allowScriptsToClose: true,
		}),
	]);

	ftsTabs = allTabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
	ftsTabsResolve(ftsTabs);

	ftsWindowId = win.id;
	creating = false;
}

function onFocusChanged(windowId) {
	if (creating) return;
	if (ftsWindowId && windowId !== ftsWindowId) {
		browser.windows.remove(ftsWindowId);
	}
}

function onWindowRemoved(windowId) {
	if (ftsWindowId === windowId) {
		ftsWindowId = undefined;
	}
}

main();
