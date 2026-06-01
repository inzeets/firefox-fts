
let ftsWindowId;
let creating = false;

function main() {
	browser.commands.onCommand.addListener(proceedCommand);
	browser.browserAction.onClicked.addListener(openFtsWindow);

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

	creating = true;
	const win = await browser.windows.create({
		height: height,
		width: width,
		left: left,
		top: top,
		type: 'popup',
		url: browser.extension.getURL('tab_switcher/switcher.html'),
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
