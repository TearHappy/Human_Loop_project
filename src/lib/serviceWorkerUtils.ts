// Service Worker Utilities for External Resource Loading
// Extracted from superdesign DesignFrame.tsx

/**
 * Generate service worker code for handling external resources (images, fonts)
 * This allows iframes to load external resources that might be blocked by CORS
 */
export const generateServiceWorkerCode = (): string => {
	return `
    self.addEventListener('fetch', event => {
      const url = event.request.url;
      
      // Only handle external image and font requests
      if (url.startsWith('http') && (
        url.includes('placehold.co') || 
        url.includes('media.giphy.com') ||
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com') ||
        url.match(/\\.(jpg|jpeg|png|gif|svg|webp|woff|woff2|ttf|otf)$/i)
      )) {
        event.respondWith(
          fetch(event.request, {
            mode: 'cors',
            credentials: 'omit'
          }).catch(() => {
            // Fallback: return a placeholder for images
            if (url.match(/\\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
              const canvas = new OffscreenCanvas(200, 120);
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#cccccc';
              ctx.fillRect(0, 0, 200, 120);
              ctx.fillStyle = '#000000';
              ctx.font = '16px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('IMAGE', 100, 60);
              
              return canvas.convertToBlob().then(blob => 
                new Response(blob, {
                  headers: { 'Content-Type': 'image/png' }
                })
              );
            }
            // For fonts, just fail gracefully
            return new Response('', { status: 404 });
          })
        );
      }
    });
  `;
};

/**
 * Generate inline script to register service worker and process images
 */
export const generateServiceWorkerScript = (): string => {
	return `
    <script>
      // Register service worker to handle external resources
      if ('serviceWorker' in navigator) {
        const swCode = \`${generateServiceWorkerCode()}\`;
        
        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        
        navigator.serviceWorker.register(swUrl).then(registration => {
          console.log('[ServiceWorker] Registered successfully');
          
          // Clean up blob URL to prevent memory leak
          URL.revokeObjectURL(swUrl);
          
          // Wait for service worker to be active
          if (registration.active) {
            processImages();
          } else {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  processImages();
                }
              });
            });
          }
        }).catch(error => {
          console.log('[ServiceWorker] Registration failed, falling back to direct loading');
          processImages();
        });
      } else {
        // Fallback for browsers without service worker support
        processImages();
      }
      
      function processImages() {
        // Force reload all external images to trigger service worker
        const images = document.querySelectorAll('img[src]');
        images.forEach(img => {
          if (img.src.startsWith('http')) {
            const originalSrc = img.src;
            img.src = '';
            setTimeout(() => {
              img.src = originalSrc;
            }, 10);
          }
        });
      }
      
      // Process images when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(processImages, 100);
        });
      } else {
        setTimeout(processImages, 100);
      }
    </script>
  `;
};

/**
 * Inject service worker script into HTML content
 */
export const injectServiceWorker = (htmlContent: string): string => {
	const serviceWorkerScript = generateServiceWorkerScript();

	// Try to inject before closing body tag
	if (htmlContent.includes("</body>")) {
		return htmlContent.replace("</body>", `${serviceWorkerScript}\n</body>`);
	}

	// Otherwise append at the end
	return htmlContent + serviceWorkerScript;
};
