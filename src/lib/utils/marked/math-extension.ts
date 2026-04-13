const DELIMITER_LIST = [
	{ left: '$$', right: '$$', display: true },
	{ left: '$', right: '$', display: false },
	{ left: '\\pu{', right: '}', display: false },
	{ left: '\\ce{', right: '}', display: false },
	{ left: '\\(', right: '\\)', display: false },
	{ left: '\\[', right: '\\]', display: true },
	{ left: '\\begin{equation}', right: '\\end{equation}', display: true }
];

// Defines characters that are allowed to immediately precede or follow a math delimiter.
const ALLOWED_SURROUNDING_CHARS =
	'\\s。，、､;；„“‘’“”（）「」『』［］《》【】‹›«»…⋯:：？！～⇒?!-\\/:-@\\[-`{-~\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';
// Modified to fit more formats in different languages. Originally: '\\s?。，、；!-\\/:-@\\[-`{-~\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';

const ALLOWED_SURROUNDING_CHARS_REGEX = new RegExp(`[${ALLOWED_SURROUNDING_CHARS}]`, 'u');

// const DELIMITER_LIST = [
//     { left: '$$', right: '$$', display: false },
//     { left: '$', right: '$', display: false },
// ];

// const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!\.,:？！。，：]|$)/;
// const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

const inlinePatterns: string[] = [];
const blockPatterns: string[] = [];

function escapeRegex(string: string) {
	return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function generateRegexRules(delimiters: typeof DELIMITER_LIST) {
	delimiters.forEach((delimiter) => {
		const { left, right, display } = delimiter;
		const escapedLeft = escapeRegex(left);
		const escapedRight = escapeRegex(right);

		if (!display) {
			// Inline delimiters: stay as they are
			inlinePatterns.push(`${escapedLeft}((?:\\\\[^]|[^\\\\])+?)${escapedRight}`);
		} else {
			// Block delimiters:
			// We change this to be "greedy" across multiple lines [\s\S]+?
			// and we remove the strict \n requirement.
			blockPatterns.push(`${escapedLeft}\s*([\s\S]+?)\s*${escapedRight}`);
		}
	});

	// Use the 'm' flag implicitly by using [\s\S] to match across newlines
	const inlineRule = new RegExp(
		`^(${inlinePatterns.join('|')})(?=[${ALLOWED_SURROUNDING_CHARS}]|$)`,
		'u'
	);
	const blockRule = new RegExp(
		`^(${blockPatterns.join('|')})(?=[${ALLOWED_SURROUNDING_CHARS}]|$)`,
		'u'
	);

	return { inlineRule, blockRule };
}

const { inlineRule, blockRule } = generateRegexRules(DELIMITER_LIST);

export default function (options = {}) {
	return {
		extensions: [inlineMath(options), blockMath(options)]
	};
}

function mathStart(src: string, displayMode: boolean) {
	for (let i = 0; i < src.length; i++) {
		const ch = src.charCodeAt(i);

		if (ch === 36 /* $ */) {
			// Display mode requires $$, skip single $ for display
			if (displayMode && src.charAt(i + 1) !== '$') {
				continue;
			}
			if (i === 0 || ALLOWED_SURROUNDING_CHARS_REGEX.test(src.charAt(i - 1))) {
				return i;
			}
		} else if (ch === 92 /* \ */) {
			const next = src.charAt(i + 1);
			// Only consider \ if followed by a valid math delimiter start
			if (displayMode) {
				// Display: \[ or \begin{equation}
				if (next !== '[' && next !== 'b') continue;
			} else {
				// Inline: \( or \ce{ or \pu{
				if (next !== '(' && next !== 'c' && next !== 'p') continue;
			}
			if (i === 0 || ALLOWED_SURROUNDING_CHARS_REGEX.test(src.charAt(i - 1))) {
				return i;
			}
		}
	}
}

// Define the shape of our math token
interface MathToken {
	type: 'inlineMath' | 'blockMath';
	raw: string;
	text: string;
	displayMode: boolean;
}

// ... (keep DELIMITER_LIST and patterns)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function inlineMath(_options: unknown) {
	return {
		name: 'inlineMath',
		level: 'inline',
		start(src: string) {
			return mathStart(src, false);
		},
		tokenizer(src: string): MathToken | undefined {
			return mathTokenizer.call(this, src, false);
		},
		renderer(token: MathToken) {
			return token.raw; // TypeScript is happy now
		}
	};
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function blockMath(_options: unknown) {
	return {
		name: 'blockMath',
		level: 'inline',
		start(src: string) {
			return mathStart(src, true);
		},
		tokenizer(src: string): MathToken | undefined {
			return mathTokenizer.call(this, src, true);
		},
		renderer(token: MathToken) {
			return token.raw;
		}
	};
}

function mathTokenizer(this: any, src: string, displayMode: boolean): MathToken | undefined {
	const ruleReg = displayMode ? blockRule : inlineRule;
	const match = src.match(ruleReg);

	if (match) {
		// match[0] is the whole string " $$ ... $$ "
		// match[1] is the delimiter " $$ "
		// match[2] is the actual LaTeX content
		const raw = match[0];
		const content = match[2];

		return {
			type: displayMode ? 'blockMath' : 'inlineMath',
			raw: raw,
			text: content.trim(), // Clean the content, but keep the LaTeX structure
			displayMode
		};
	}
}
