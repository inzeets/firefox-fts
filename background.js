
let ftsWindowId;
let creating = false;
let ftsTabs;

function main() {
	browser.commands.onCommand.addListener(proceedCommand);
	browser.action.onClicked.addListener(openFtsWindow);

	browser.windows.onFocusChanged.addListener(onFocusChanged);
	browser.windows.onRemoved.addListener(onWindowRemoved);
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

	// Pre-fetch tabs so the switcher page can render its list on first paint
	// (avoids the window appearing empty and then populating).
	const allTabs = await browser.tabs.query({windowType: 'normal'});
	ftsTabs = allTabs.sort((a, b) => b.lastAccessed - a.lastAccessed);

	creating = true;
	const win = await browser.windows.create({
		height: height,
		width: width,
		left: left,
		top: top,
		type: 'popup',
		url: browser.runtime.getURL('tab_switcher/switcher.html'),
		allowScriptsToClose: true,
	});
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
