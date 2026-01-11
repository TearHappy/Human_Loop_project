/**
 * Element Selector Script Generator
 *
 * Generates vanilla JavaScript code to be injected into iframe for element selection
 * Based on react-grab implementation but adapted for plain HTML/CSS preview
 *
 * Features:
 * - Pink overlay highlighting hovered elements
 * - Smooth animation following mouse
 * - Click to copy element HTML to clipboard
 * - Visual feedback (spinner, success message)
 * - Clean separation from host application
 */

export function generateElementSelectorScript(fileName = "preview"): string {
	return `
(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    OVERLAY_COLOR: 'rgba(210, 57, 192, 0.2)',
    OVERLAY_BORDER: '1px solid rgb(210, 57, 192)',
    LERP_FACTOR: 0.95,
    Z_INDEX_OVERLAY: 2147483646,
    Z_INDEX_LABEL: 2147483647,
    Z_INDEX_INDICATOR: 2147483648,
    LABEL_OFFSET: 6,
    VIEWPORT_MARGIN: 8,
    INDICATOR_PADDING: 4,
    SUCCESS_VISIBLE_MS: 1500,
    FADE_MS: 200,
    PINK_COLOR: 'rgb(210, 57, 192)',
    INDICATOR_BG: '#fde7f7',
    INDICATOR_COLOR: '#b21c8e',
    INDICATOR_BORDER: '#f7c5ec',
    fileName: '${fileName}'
  };

  // Utility: Linear interpolation for smooth animation
  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  // Utility: Get element's bounding box
  function getRect(element) {
    return element.getBoundingClientRect();
  }

  // Utility: Check if element is visible
  function isElementVisible(element, computedStyle) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    if (computedStyle.display === 'none') return false;
    if (computedStyle.visibility === 'hidden') return false;
    if (parseFloat(computedStyle.opacity) === 0) return false;
    const rect = getRect(element);
    return rect.width > 0 && rect.height > 0;
  }

  // Create root container for overlays
  function createRoot() {
    const root = document.createElement('div');
    root.id = 'element-selector-root';
    root.setAttribute('data-element-selector', 'true');
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = '0';
    root.style.height = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = String(CONFIG.Z_INDEX_OVERLAY);
    document.body.appendChild(root);
    return root;
  }

  // Create selection overlay element
  function createSelectionElement() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '-1000px';
    overlay.style.left = '-1000px';
    overlay.style.width = '0px';
    overlay.style.height = '0px';
    overlay.style.border = CONFIG.OVERLAY_BORDER;
    overlay.style.backgroundColor = CONFIG.OVERLAY_COLOR;
    overlay.style.borderRadius = '0px';
    overlay.style.transform = 'none';
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = String(CONFIG.Z_INDEX_OVERLAY);
    overlay.style.boxSizing = 'border-box';
    overlay.style.display = 'none';
    overlay.style.cursor = 'crosshair';
    return overlay;
  }

  // Update selection overlay with smooth lerp animation
  function updateSelectionElement(element, target) {
    const currentTop = parseFloat(element.style.top) || 0;
    const currentLeft = parseFloat(element.style.left) || 0;
    const currentWidth = parseFloat(element.style.width) || 0;
    const currentHeight = parseFloat(element.style.height) || 0;

    element.style.top = lerp(currentTop, target.y, CONFIG.LERP_FACTOR) + 'px';
    element.style.left = lerp(currentLeft, target.x, CONFIG.LERP_FACTOR) + 'px';
    element.style.width = lerp(currentWidth, target.width, CONFIG.LERP_FACTOR) + 'px';
    element.style.height = lerp(currentHeight, target.height, CONFIG.LERP_FACTOR) + 'px';
    element.style.borderRadius = target.borderRadius;
    element.style.transform = target.transform;
  }

  // Create label showing tag name
  function createLabel() {
    const label = document.createElement('div');
    label.style.position = 'fixed';
    label.style.padding = '2px 6px';
    label.style.backgroundColor = CONFIG.INDICATOR_BG;
    label.style.color = CONFIG.INDICATOR_COLOR;
    label.style.border = '1px solid ' + CONFIG.INDICATOR_BORDER;
    label.style.borderRadius = '4px';
    label.style.fontSize = '11px';
    label.style.fontWeight = '500';
    label.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    label.style.zIndex = String(CONFIG.Z_INDEX_LABEL);
    label.style.pointerEvents = 'none';
    label.style.opacity = '0';
    label.style.transition = 'opacity 0.2s ease-in-out';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.whiteSpace = 'nowrap';
    return label;
  }

  // Update label position and content
  function updateLabel(label, x, y, tagName) {
    const rect = getRect(label);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let labelLeft = Math.round(x);
    let labelTop = Math.round(y) - rect.height - CONFIG.LABEL_OFFSET;

    // Clamp to viewport
    const minLeft = CONFIG.VIEWPORT_MARGIN;
    const minTop = CONFIG.VIEWPORT_MARGIN;
    const maxLeft = viewportWidth - rect.width - CONFIG.VIEWPORT_MARGIN;
    const maxTop = viewportHeight - rect.height - CONFIG.VIEWPORT_MARGIN;

    labelLeft = Math.max(minLeft, Math.min(labelLeft, maxLeft));
    labelTop = Math.max(minTop, Math.min(labelTop, maxTop));

    label.style.left = labelLeft + 'px';
    label.style.top = labelTop + 'px';

    const tagSpan = document.createElement('span');
    tagSpan.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    tagSpan.textContent = '<' + tagName + '>';
    label.innerHTML = '';
    label.appendChild(tagSpan);

    if (label.style.opacity !== '1') {
      requestAnimationFrame(() => {
        label.style.opacity = '1';
      });
    }
  }

  // Create spinner element
  function createSpinner() {
    const spinner = document.createElement('span');
    spinner.style.display = 'inline-block';
    spinner.style.width = '8px';
    spinner.style.height = '8px';
    spinner.style.border = '1.5px solid ' + CONFIG.PINK_COLOR;
    spinner.style.borderTopColor = 'transparent';
    spinner.style.borderRadius = '50%';
    spinner.style.marginRight = '4px';
    spinner.style.verticalAlign = 'middle';
    spinner.style.animation = 'spin 0.6s linear infinite';
    return spinner;
  }

  // Add spinner animation keyframes
  function addSpinnerAnimation() {
    if (!document.getElementById('element-selector-keyframes')) {
      const style = document.createElement('style');
      style.id = 'element-selector-keyframes';
      style.textContent = \`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      \`;
      document.head.appendChild(style);
    }
  }

  // Create grabbed indicator (success message)
  function createGrabbedIndicator(root, x, y, tagName) {
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.padding = '2px 6px';
    indicator.style.backgroundColor = CONFIG.INDICATOR_BG;
    indicator.style.color = CONFIG.INDICATOR_COLOR;
    indicator.style.border = '1px solid ' + CONFIG.INDICATOR_BORDER;
    indicator.style.borderRadius = '4px';
    indicator.style.fontSize = '11px';
    indicator.style.fontWeight = '500';
    indicator.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    indicator.style.zIndex = String(CONFIG.Z_INDEX_INDICATOR);
    indicator.style.pointerEvents = 'none';
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity ' + CONFIG.FADE_MS + 'ms ease-in-out';
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.whiteSpace = 'nowrap';

    // Position
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.visibility = 'hidden';
    tempDiv.textContent = 'Grabbed <' + tagName + '>';
    document.body.appendChild(tempDiv);
    const rect = getRect(tempDiv);
    document.body.removeChild(tempDiv);

    let indicatorLeft = Math.round(x);
    let indicatorTop = Math.round(y) - rect.height - CONFIG.LABEL_OFFSET;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minLeft = CONFIG.VIEWPORT_MARGIN;
    const minTop = CONFIG.VIEWPORT_MARGIN;
    const maxLeft = viewportWidth - rect.width - CONFIG.VIEWPORT_MARGIN;
    const maxTop = viewportHeight - rect.height - CONFIG.VIEWPORT_MARGIN;

    indicatorLeft = Math.max(minLeft, Math.min(indicatorLeft, maxLeft));
    indicatorTop = Math.max(minTop, Math.min(indicatorTop, maxTop));

    indicator.style.left = indicatorLeft + 'px';
    indicator.style.top = indicatorTop + 'px';

    // Content
    const checkmark = document.createElement('span');
    checkmark.textContent = '✓';
    checkmark.style.display = 'inline-block';
    checkmark.style.marginRight = '4px';
    checkmark.style.fontWeight = '600';

    const text = document.createElement('span');
    text.textContent = 'Grabbed ';
    const tagSpan = document.createElement('span');
    tagSpan.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    tagSpan.textContent = '<' + tagName + '>';
    text.appendChild(tagSpan);

    indicator.appendChild(checkmark);
    indicator.appendChild(text);

    root.appendChild(indicator);

    requestAnimationFrame(() => {
      indicator.style.opacity = '1';
    });

    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => {
        indicator.remove();
      }, CONFIG.FADE_MS);
    }, CONFIG.SUCCESS_VISIBLE_MS);
  }

  // Create flash overlay on grabbed element
  function createGrabbedFlash(root, rect, borderRadius, transform) {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = rect.y + 'px';
    flash.style.left = rect.x + 'px';
    flash.style.width = rect.width + 'px';
    flash.style.height = rect.height + 'px';
    flash.style.borderRadius = borderRadius;
    flash.style.transform = transform;
    flash.style.pointerEvents = 'none';
    flash.style.border = CONFIG.OVERLAY_BORDER;
    flash.style.backgroundColor = CONFIG.OVERLAY_COLOR;
    flash.style.zIndex = String(CONFIG.Z_INDEX_OVERLAY);
    flash.style.boxSizing = 'border-box';
    flash.style.transition = 'opacity 0.3s ease-out';
    flash.style.opacity = '1';

    root.appendChild(flash);

    requestAnimationFrame(() => {
      flash.style.opacity = '0';
    });

    setTimeout(() => {
      flash.remove();
    }, 300);
  }

  // Get HTML snippet of element
  function getHTMLSnippet(element) {
    const tagName = element.tagName.toLowerCase();
    const attributes = Array.from(element.attributes)
      .filter(attr => !attr.name.startsWith('data-element-selector'))
      .map(attr => attr.name + '="' + attr.value + '"')
      .join(' ');
    
    const attributesStr = attributes ? ' ' + attributes : '';
    
    // Get inner content (truncated if too long)
    let innerHTML = element.innerHTML.trim();
    if (innerHTML.length > 200) {
      innerHTML = innerHTML.substring(0, 200) + '...';
    }
    
    if (innerHTML) {
      return '<' + tagName + attributesStr + '>\\n  ' + innerHTML + '\\n</' + tagName + '>';
    } else {
      return '<' + tagName + attributesStr + ' />';
    }
  }

  // Copy text to clipboard
  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return Promise.resolve();
    }
  }

  // Get element at mouse position
  function getElementAtPosition(x, y, overlay) {
    // Temporarily hide overlay to get element underneath
    overlay.style.pointerEvents = 'none';
    const elements = document.elementsFromPoint(x, y);
    overlay.style.pointerEvents = 'auto';

    for (const element of elements) {
      // Skip our own overlays
      if (element.closest('[data-element-selector]')) {
        continue;
      }

      const computedStyle = window.getComputedStyle(element);
      if (!isElementVisible(element, computedStyle)) {
        continue;
      }

      return element;
    }

    return null;
  }

  // Main initialization
  function init() {
    addSpinnerAnimation();
    
    const root = createRoot();
    const selectionOverlay = createSelectionElement();
    const label = createLabel();
    
    root.appendChild(selectionOverlay);
    root.appendChild(label);

    let hoveredElement = null;
    let isCopying = false;
    let mouseX = -1000;
    let mouseY = -1000;
    let renderScheduled = false;
    let isEnabled = false;  // Start disabled, wait for enable message

    // Enable/disable selector
    function enableSelector() {
      isEnabled = true;
      root.style.display = 'block';
      scheduleRender();
    }

    function disableSelector() {
      isEnabled = false;
      root.style.display = 'none';
      selectionOverlay.style.display = 'none';
      label.style.opacity = '0';
    }

    // Listen for toggle messages from parent
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'toggleSelector') {
        if (e.data.enabled) {
          enableSelector();
        } else {
          disableSelector();
        }
      }
    });

    // Mouse move handler
    function handleMouseMove(e) {
      if (!isEnabled) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      scheduleRender();
    }

    // Click handler
    function handleClick(e) {
      if (!isEnabled) return;
      if (!hoveredElement) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (isCopying) return;
      isCopying = true;

      const element = hoveredElement;
      const tagName = element.tagName.toLowerCase();
      const rect = getRect(element);
      const computedStyle = window.getComputedStyle(element);

      // Show processing indicator
      const processingIndicator = document.createElement('div');
      processingIndicator.style.position = 'fixed';
      processingIndicator.style.padding = '2px 6px';
      processingIndicator.style.backgroundColor = CONFIG.INDICATOR_BG;
      processingIndicator.style.color = CONFIG.INDICATOR_COLOR;
      processingIndicator.style.border = '1px solid ' + CONFIG.INDICATOR_BORDER;
      processingIndicator.style.borderRadius = '4px';
      processingIndicator.style.fontSize = '11px';
      processingIndicator.style.fontWeight = '500';
      processingIndicator.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      processingIndicator.style.zIndex = String(CONFIG.Z_INDEX_INDICATOR);
      processingIndicator.style.pointerEvents = 'none';
      processingIndicator.style.opacity = '0';
      processingIndicator.style.transition = 'opacity 0.2s ease-in-out';
      processingIndicator.style.display = 'flex';
      processingIndicator.style.alignItems = 'center';
      processingIndicator.style.whiteSpace = 'nowrap';
      processingIndicator.style.left = rect.left + 'px';
      processingIndicator.style.top = (rect.top - 30) + 'px';

      const spinner = createSpinner();
      const text = document.createElement('span');
      text.textContent = 'Grabbing…';

      processingIndicator.appendChild(spinner);
      processingIndicator.appendChild(text);
      root.appendChild(processingIndicator);

      requestAnimationFrame(() => {
        processingIndicator.style.opacity = '1';
      });

      // Get element information and position
      const elementInfo = {
        tagName: tagName,
        html: getHTMLSnippet(element),
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        },
        position: {
          x: e.clientX,
          y: e.clientY
        }
      };

      // Send message to parent window with element info and coordinates
      window.parent.postMessage({
        type: 'elementSelectorClick',
        fileName: CONFIG.fileName,
        elementInfo: elementInfo,
        x: e.clientX,
        y: e.clientY
      }, '*');

      copyToClipboard(htmlSnippet)
        .then(() => {
          // Success!
          processingIndicator.remove();
          createGrabbedFlash(root, rect, computedStyle.borderRadius || '0px', computedStyle.transform || 'none');
          createGrabbedIndicator(root, rect.left, rect.top, tagName);
        })
        .catch(err => {
          console.error('Failed to copy to clipboard:', err);
          processingIndicator.textContent = '✗ Failed to copy';
          setTimeout(() => {
            processingIndicator.remove();
          }, 2000);
        })
        .finally(() => {
          isCopying = false;
        });
    }

    // Render function
    function render() {
      renderScheduled = false;

      const element = getElementAtPosition(mouseX, mouseY, selectionOverlay);

      if (!element) {
        if (selectionOverlay.style.display !== 'none') {
          selectionOverlay.style.display = 'none';
          label.style.opacity = '0';
        }
        hoveredElement = null;
        return;
      }

      hoveredElement = element;
      const rect = getRect(element);
      const computedStyle = window.getComputedStyle(element);
      const tagName = element.tagName.toLowerCase();

      updateSelectionElement(selectionOverlay, {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: computedStyle.borderRadius || '0px',
        transform: computedStyle.transform || 'none'
      });

      if (selectionOverlay.style.display !== 'block') {
        selectionOverlay.style.display = 'block';
      }

      updateLabel(label, rect.left, rect.top, tagName);
    }

    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(render);
    }

    // Continuous render loop for smooth animation
    function continuousRender() {
      scheduleRender();
      requestAnimationFrame(continuousRender);
    }

    // Event listeners
    document.addEventListener('mousemove', handleMouseMove);
    selectionOverlay.addEventListener('click', handleClick, true);

    // Start render loop
    continuousRender();

    console.log('[Element Selector] Initialized');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`.trim();
}
