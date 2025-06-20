(function () {
"use strict";

var currentOptions;

function clone (data) {
	return JSON.parse(JSON.stringify(data));
}

function loadOptions () {
	try {
		return JSON.parse(localStorage.getItem('deng-settings') || 'x');
	} catch (e) {
	}
	return {start: false, end: true, ignoreCase: true, max: 100, timeout: 2000, min: 3};
}

function getOptions () {
	return clone(currentOptions);
}

function setOptions (options) {
	currentOptions = options;
	try {
		localStorage.setItem('deng-settings', JSON.stringify(currentOptions));
	} catch (e) {
	}
}

function escapeRE (pattern) {
	return pattern.replace(/([\\{}()|.?*+\-\^$\[\]])/g, '\\$1');
}

function makeRE (search, options) {
	var start, end;
	start = options.start ? '(?:^| \\| | :: |; )(?:to )?' : '\\b';
	end = options.end ? '\\b' : '';
	search = search.replace(/[<>\[\]{}]/g, ''); //formatting stuff
	search = search.replace(/::|\|/g, ' '); //separators in entries
	search = search.replace(/\s+/g, ' ');
	search = search.replace(/^[ ,;:+']+/, '').replace(/[ ,:-;']+$/, ' ');
	if (search.charAt(search.length - 1) === ' ') {
		end = '\\b';
		search = search.slice(0, -1);
	}
	if (search.charAt(0) === '*') {
		start = '';
		search = search.slice(1);
	}
	if (search.charAt(search.length - 1) === '*') {
		end = '';
		search = search.slice(0, -1);
	}
	if (search.length < options.min) {
		return false;
	}
	search = escapeRE(search);
	search = search.replace(/\\\*/g, '\\S*');
	return new RegExp('(' + start + search + end + ')', options.ignoreCase ? 'i' : '');
}

function contains (text, re) {
	return re.test(text);
}

function formatEntry (entry, highlight) {
	return entry
		.replace(/&/g, '&amp;')
		.replace(/<([^<>]*)>/g, '<small>&lt;$1&gt;</small>')
		.replace(/(\[[^\[\]]+\]|\{[^\{\}]+\})/g, '<i>$1</i>')
		.replace(highlight, '<mark>$1</mark>');
}

function formatLine (line, highlight) {
	var open = false;
	line = line.split(' :: ').map(function (part) {
		return part.split(' | ');
	});
	line = line[0].map(function (l, i) {
		return [l, line[1][i]];
	});
	if (!contains(line[0][0], highlight) && !contains(line[0][1], highlight)) {
		open = true;
		line = line.filter(function (l, i) {
			return i === 0 || contains(l[0], highlight) || contains(l[1], highlight);
		});
	}
	return line.map(function (l, i) {
		var cls = 'sub-line';
		if (i === 0) {
			cls = line.length === 1 ? 'only-line' : 'main-line';
		}
		cls += ' ' + (open ? 'open' : 'closed');
		return '<tr class="' + cls + '">' +
			'<td lang="de">' + formatEntry(l[0], highlight) + '</td>' +
			'<td lang="en">' + formatEntry(l[1], highlight) + '</td></tr>';
	}).join('');
}

function getWeight (entry, search) {
	var weight, match, parts;
	entry = entry.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, '').replace(/ {2,}/g, ' ');
	match = search.exec(entry);
	if (!match) {
		return 0;
	}
	//TODO for more than one match use the best instead of first
	weight = 1;
	if (
		match.index === 0 ||
		(/(?: \| | :: |; )(?:to )?$/).test(entry.slice(0, match.index))
	) {
		weight += 4;
	}
	if (
		match.index + match[1].length === entry.length ||
		(/^(?: \| | :: |; )/).test(entry.slice(match.index + match[1].length))
	) {
		weight += 2;
	}
	parts = entry.split(' :: ');
	if (search.test(parts[0].split(' | ')[0]) || search.test(parts[1].split(' | ')[0])) {
		weight += 1;
	}
	return weight;
}

function formatResult (entries, search, options) {
	var result, more;
	result = entries.filter(function (entry) {
		return contains(entry, search);
	});

	result = result.map(function (entry, i) {
		return [entry, getWeight(entry, search), i];
	});
	result.sort(function (a, b) {
		return (b[1] - a[1]) || (a[2] - b[2]);
	});
	result = result.map(function (entry) {
		return entry[0];
	});

	if (result.length > options.max) {
		result.length = options.max;
		more = true;
	}
	result = result.map(function (entry) {
		return formatLine(entry, search);
	}).join('');
	return result ?
		'<table>' + result + '</table>' + (more ? '<p>More results available</p>' : '') :
		'<p>No result</p>';
}

function toggle (line) {
	while (true) {
		line.classList.toggle('open');
		line.classList.toggle('closed');
		line = line.nextSibling;
		if (!line || !line.classList.contains('sub-line')) {
			return;
		}
	}
}

function getParent (el, tagName) {
	while (el && el.tagName !== tagName) {
		el = el.parentElement;
	}
	return el;
}

function initToggle (resultArea) {
	resultArea.addEventListener('click', function (e) {
		var el = getParent(e.target, 'TR');
		if (el && el.classList.contains('main-line')) {
			toggle(el);
		}
	});
}

function getFile (callback) {
	var xhr = new XMLHttpRequest();
	xhr.onload = function () {
		callback(xhr.responseText);
	};
	xhr.open('GET', 'res/de-en.txt');
	xhr.overrideMimeType('text/plain');
	xhr.send();
}

function getEntries (callback) {
	getFile(function (entries) {
		callback(entries.split('\n').filter(function (line) {
			return line && line.charAt(0) !== '#';
		}));
	});
}

function showResults (entries, search, resultArea, options) {
	var re = makeRE(search, options);
	if (re) {
		resultArea.innerHTML = formatResult(entries, re, options);
		document.documentElement.scrollTop = 0;
	}
}

function showConfig () {
	var options = getOptions();
	document.getElementById('options-start').checked = options.start;
	document.getElementById('options-end').checked = options.end;
	document.getElementById('options-ignoreCase').checked = options.ignoreCase;
	document.getElementById('options-max').value = options.max;
	document.getElementById('options-timeout').value = options.timeout;
	document.getElementById('options-min').value = options.min;
}

function saveConfig () {
	var options = {
		start: document.getElementById('options-start').checked,
		end: document.getElementById('options-end').checked,
		ignoreCase: document.getElementById('options-ignoreCase').checked,
		max: Number(document.getElementById('options-max').value),
		timeout: Number(document.getElementById('options-timeout').value),
		min: Number(document.getElementById('options-min').value)
	}, oldOptions = getOptions();
	if (isNaN(options.max) || options.max <= 0 || Math.floor(options.max) !== options.max) {
		options.max = oldOptions.max;
	}
	if (isNaN(options.min) || options.min <= 0 || Math.floor(options.min) !== options.min) {
		options.min = oldOptions.min;
	}
	if (isNaN(options.timeout) || options.timeout < 0 || Math.floor(options.timeout) !== options.timeout) {
		options.timeout = oldOptions.timeout;
	}
	setOptions(options);
}

function init () {
	var input = document.getElementById('input'),
		resultArea = document.getElementById('result'),
		submitButton = document.getElementById('submit'),
		configButton = document.getElementById('config'),
		backButton = document.getElementById('options-back'),
		mainPage = document.getElementById('main'),
		settingsPage = document.getElementById('settings');

	function toggleSubmitConfig () {
		if (input.value) {
			submitButton.style.display = '';
			configButton.style.display = 'none';
		} else {
			submitButton.style.display = 'none';
			configButton.style.display = '';
		}
	}

	currentOptions = loadOptions();
	initToggle(resultArea);
	toggleSubmitConfig();
	configButton.addEventListener('click', function () {
		mainPage.hidden = true;
		settingsPage.hidden = false;
		showConfig();
	});
	backButton.addEventListener('click', function () {
		mainPage.hidden = false;
		settingsPage.hidden = true;
		saveConfig();
	});

	getEntries(function (entries) {
		var lastInput;

		input.addEventListener('input', function () {
			var options = getOptions();
			toggleSubmitConfig();
			if (options.timeout) {
				options.end = false;
				if (lastInput) {
					clearTimeout(lastInput);
				}
				lastInput = setTimeout(function () {
					showResults(entries, input.value, resultArea, options);
				}, options.timeout);
			}
		});
		document.getElementById('search').addEventListener('submit', function (e) {
			var options = getOptions();
			e.preventDefault();
			if (lastInput) {
				clearTimeout(lastInput);
			}
			options.min = 1;
			showResults(entries, input.value, resultArea, options);
		});
	});
}

init();

})();