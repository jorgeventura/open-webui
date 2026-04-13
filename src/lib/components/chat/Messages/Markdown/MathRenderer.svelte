<script lang="ts" context="module">
	import { browser } from '$app/environment';

	let mathjaxPromise: Promise<any> | null = null;

	function loadMathJax() {
		if (!browser) return Promise.reject();
		if (!mathjaxPromise) {
			mathjaxPromise = import('mathjax/es5/tex-svg.js').then(() => {
				return (window as any).MathJax;
			});
		}
		return mathjaxPromise;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let { content, displayMode = false } = $props();
	let outputHtml = $state('');

	const renderMath = async (mathText: string) => {
		if (!mathText || !browser) return;

		try {
			const MathJax = await loadMathJax();

			// CLEANING STEP: Remove any potential citation tokens [1#suffix]
			// that might have leaked into the math string
			const cleanText = mathText.replace(/\[\d+(?:#[^\]]*)?\]/g, '');

			if (MathJax && MathJax.tex2svg) {
				const node = MathJax.tex2svg(cleanText, { display: displayMode });
				if (node) {
					// MathJax 4 returns a wrapper. We want the inner container.
					outputHtml = node.outerHTML;
				}
			}
		} catch (e) {
			console.error('[MathRenderer] Error:', e);
			outputHtml = '';
		}
	};

	onMount(() => renderMath(content));
	$effect(() => { renderMath(content); });
</script>

{#if outputHtml}
	<span class="math-renderer {displayMode ? 'math-display' : 'inline-math'}">
		{@html outputHtml}
	</span>
{:else}
	<span class={displayMode ? 'math-display' : 'inline-math'}>
		{displayMode ? `$$${content}$$` : `$${content}$`}
	</span>
{/if}

<style>
	.math-renderer {
		font-size: 1.1em;
		/* Ensures the SVG doesn't have a weird background */
		background: transparent !important;
	}

	.math-renderer :global(svg) {
		display: inline-block !important;
		vertical-align: middle !important;
		max-width: 100%;
		fill: currentColor;
	}

    /* Fix for block equations overflow */
	:global(.math-display) {
		display: flex;
		justify-content: center;
		margin: 1rem 0;
        width: 100%;
	}

	.inline-math {
		display: inline-block;
		vertical-align: middle;
		padding: 0 2px;
	}
</style>
