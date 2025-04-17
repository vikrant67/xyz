/**
 * Cross-Framework Spell Checker with Cookie Authentication
 * This vanilla JS script can be added to any frontend to provide spell checking capabilities.
 */

(function() {
    // Configuration (can be customized for each deployment)
    const config = {
      apiEndpoint: 'http://localhost:8787/api/v1/audit',
      debounceMs: 500,
      inputSelector: 'input[type="text"], textarea, [contenteditable="true"]',
      // Authentication configuration
      auth: {
        // Set to true to use cookie-based authentication (credentials: 'include')
        useCookies: true,
        // Set withCredentials for XMLHttpRequest compatibility
        withCredentials: true,
        // For token-based auth methods (not needed if using cookies)
        tokenRetrievers: {
          // Function to extract token from Cognito
          cognito: function() {
            try {
              return localStorage.getItem('CognitoIdentityServiceProvider.YOUR_CLIENT_ID.YOUR_USER.accessToken') ||
                     sessionStorage.getItem('CognitoIdentityServiceProvider.YOUR_CLIENT_ID.YOUR_USER.accessToken');
            } catch (e) {
              console.error('Failed to retrieve Cognito token:', e);
              return null;
            }
          },
          // Function to extract token from Firebase
          firebase: function() {
            try {
              if (window.firebase && firebase.auth) {
                const currentUser = firebase.auth().currentUser;
                if (currentUser) {
                  return currentUser.getIdToken(true);
                }
              }
              return localStorage.getItem('firebaseAuthToken');
            } catch (e) {
              console.error('Failed to retrieve Firebase token:', e);
              return null;
            }
          }
        },
        // Detect which auth method to use based on available globals or other signals
        detectAuthMethod: function() {
          if (window.firebase) return 'firebase';
          if (window.AmazonCognitoIdentity || 
              document.querySelector('[data-auth="cognito"]')) return 'cognito';
          return null; // No token-based auth or unknown
        }
      },
      cssPrefix: 'spellcheck-',
      // CSS styles
      cssOverrides: {
        spellingMistakeStyle: 'text-decoration: underline wavy red;',
        grammarMistakeStyle: 'text-decoration: underline wavy blue;'
      },
      // Debug mode to log requests
      debug: false,
      // CORS configuration
      cors: {
        // Explicitly request CORS mode
        mode: 'cors',
        // Always include credentials (cookies)
        credentials: 'include'
      }
    };
  
    // State management
    const state = {
      activeInputs: new Map(), // Map of inputs to their current state
      currentAuthMethod: null,
      lastApiResponse: null // Store API responses here instead of on window.SpellChecker
    };
  
    /**
     * Debounce function to limit API calls
     */
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  
    /**
     * Prepare authentication for API request
     * Returns headers object with appropriate authentication
     */
    async function prepareAuthHeaders() {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // If using cookies, we don't need to add auth headers
      if (config.auth.useCookies) {
        return headers;
      }
      
      // Otherwise, try to get a token
      if (!state.currentAuthMethod) {
        state.currentAuthMethod = config.auth.detectAuthMethod();
      }
      
      if (!state.currentAuthMethod) {
        console.warn('No token-based authentication method detected');
        return headers;
      }
      
      const retriever = config.auth.tokenRetrievers[state.currentAuthMethod];
      if (!retriever) {
        console.error(`No token retriever for auth method: ${state.currentAuthMethod}`);
        return headers;
      }
      
      // Get the token
      try {
        const token = retriever();
        const resolvedToken = token instanceof Promise ? await token : token;
        
        if (resolvedToken) {
          headers['Authorization'] = `Bearer ${resolvedToken}`;
        }
      } catch (e) {
        console.error('Error retrieving auth token:', e);
      }
      
      return headers;
    }
  
    /**
     * Parse API response to uniform format for internal use
     * Converts various issue formats into a consistent mistake object
     */
    function parseApiResponse(data) {
      const mistakes = [];
      
      if (data && data.text) {
        // Handle spelling issues
        if (Array.isArray(data.text.spelling_issues)) {
          data.text.spelling_issues.forEach(issue => {
            if (issue.location) {
              mistakes.push({
                startIndex: issue.location.offset,
                endIndex: issue.location.offset + issue.location.length,
                message: issue.message,
                suggestions: issue.suggestions || [],
                type: 'spelling',
                code: issue.code
              });
            }
          });
        }
        
        // Handle grammar issues
        if (Array.isArray(data.text.grammar_issues)) {
          data.text.grammar_issues.forEach(issue => {
            if (issue.location) {
              mistakes.push({
                startIndex: issue.location.offset,
                endIndex: issue.location.offset + issue.location.length,
                message: issue.message,
                suggestions: issue.suggestions || [],
                type: 'grammar',
                code: issue.code
              });
            }
          });
        }
      }
      
      // Handle legacy format if needed
      if (data && Array.isArray(data.mistakes)) {
        data.mistakes.forEach(mistake => {
          if (mistake.startIndex !== undefined && mistake.endIndex !== undefined) {
            mistakes.push({
              ...mistake,
              type: mistake.type || 'spelling'
            });
          }
        });
      }
      
      return mistakes;
    }
  
    /**
     * Call the spell check API
     */
    async function checkSpelling(text, inputElement) {
      if (!text || text.trim() === '') {
        clearHighlights(inputElement);
        return;
      }
  
      try {
        const headers = await prepareAuthHeaders();
        
        // Always use include for credentials when cookies are expected
        // This is crucial for cross-origin requests with cookies
        const fetchOptions = {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ "content": text, "content_type": "text" }),
          credentials: 'include', // Always use 'include' to send cookies cross-origin
          mode: 'cors' // Explicitly set CORS mode
        };
        
        if (config.debug) {
          console.log('Spell check request:', {
            url: config.apiEndpoint,
            options: {
              ...fetchOptions,
              headers: { ...fetchOptions.headers }
            }
          });
          
          // Debug: List all cookies
          console.log('Document cookies:', document.cookie);
          
          // List cookies that would be sent with this request (SameSite compatible)
          const cookieNames = document.cookie.split(';').map(cookie => 
            cookie.trim().split('=')[0]
          );
          console.log('Cookie names available:', cookieNames);
        }
        
        const response = await fetch(config.apiEndpoint, fetchOptions);
  
        if (!response.ok) {
          console.error(`API returned status: ${response.status}`);
          throw new Error(`API returned ${response.status}`);
        }
  
        const data = await response.json();
        
        // For testing - store the last API response in our state
        state.lastApiResponse = data;
        // Make the response available on the SpellChecker object
        if (window.SpellChecker) {
          window.SpellChecker._lastApiResponse = data;
        }
        
        // Parse the API response and get uniform mistakes format
        const parsedMistakes = parseApiResponse(data);
        highlightMistakes(inputElement, parsedMistakes);
      } catch (error) {
        console.error('Spell check failed:', error);
        // Optionally, provide visual feedback about the error
      }
    }
  
    /**
     * Get the style for a specific mistake type
     */
    function getMistakeStyle(mistakeType) {
      if (mistakeType === 'grammar') {
        return config.cssOverrides.grammarMistakeStyle || 'text-decoration: underline wavy blue;';
      }
      return config.cssOverrides.spellingMistakeStyle || 'text-decoration: underline wavy red;';
    }
  
    /**
     * Highlight spelling mistakes in the UI
     */
    function highlightMistakes(inputElement, mistakes) {
      // For contenteditable elements
      if (inputElement.getAttribute('contenteditable') === 'true') {
        highlightContentEditableMistakes(inputElement, mistakes);
        return;
      }
  
      // For input/textarea elements
      clearHighlights(inputElement);
      
      if (mistakes.length === 0) return;
      
      // Approach 1: Use inline styles for input elements
      if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
        // We can't add HTML inside inputs, so we'll wrap the input
        // and apply our highlighting as a layer on top
        
        // First, ensure the input has a wrapper
        let wrapper = inputElement.parentElement;
        if (!wrapper.classList.contains(`${config.cssPrefix}input-wrapper`)) {
          // Create a wrapper if it doesn't exist
          wrapper = document.createElement('div');
          wrapper.className = `${config.cssPrefix}input-wrapper`;
          wrapper.style.position = 'relative';
          wrapper.style.display = 'inline-block';
          inputElement.parentNode.insertBefore(wrapper, inputElement);
          wrapper.appendChild(inputElement);
        }
        
        // Create the overlay element
        const overlay = document.createElement('div');
        overlay.className = `${config.cssPrefix}overlay`;
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1';
        overlay.style.boxSizing = 'border-box';
        overlay.style.padding = window.getComputedStyle(inputElement).padding;
        
        // Calculate text styles to match the input
        const computedStyle = window.getComputedStyle(inputElement);
        const textContainer = document.createElement('div');
        textContainer.style.position = 'absolute';
        textContainer.style.top = '0';
        textContainer.style.left = '0';
        textContainer.style.width = '100%';
        textContainer.style.height = '100%';
        textContainer.style.fontFamily = computedStyle.fontFamily;
        textContainer.style.fontSize = computedStyle.fontSize;
        textContainer.style.fontWeight = computedStyle.fontWeight;
        textContainer.style.letterSpacing = computedStyle.letterSpacing;
        textContainer.style.textAlign = computedStyle.textAlign;
        textContainer.style.lineHeight = computedStyle.lineHeight;
        textContainer.style.paddingLeft = computedStyle.paddingLeft;
        textContainer.style.paddingTop = computedStyle.paddingTop;
        textContainer.style.paddingRight = computedStyle.paddingRight;
        textContainer.style.paddingBottom = computedStyle.paddingBottom;
        textContainer.style.boxSizing = 'border-box';
        textContainer.style.overflow = 'hidden';
        textContainer.style.whiteSpace = 'pre-wrap';
        textContainer.style.pointerEvents = 'none'; // Make sure we can still click through
        
        // Create text with highlights
        let text = inputElement.value || '';
        let html = '';
        let lastIndex = 0;
        
        // Sort mistakes by position
        mistakes.sort((a, b) => a.startIndex - b.startIndex);
        
        for (const mistake of mistakes) {
          // Add text before the mistake
          html += escapeHtml(text.substring(lastIndex, mistake.startIndex));
          
          // Get style based on mistake type
          const style = getMistakeStyle(mistake.type);
          
          // Add the mistake with highlight
          html += `<span class="${config.cssPrefix}mistake ${config.cssPrefix}${mistake.type}" 
                    style="${style}" 
                    title="${mistake.message || ''}">${
            escapeHtml(text.substring(mistake.startIndex, mistake.endIndex))
          }</span>`;
          
          lastIndex = mistake.endIndex;
        }
        
        // Add any remaining text and replace spaces with &nbsp; to maintain spacing
        html += escapeHtml(text.substring(lastIndex));
        
        // Set content
        textContainer.innerHTML = html;
        overlay.appendChild(textContainer);
        wrapper.appendChild(overlay);
        
        // Store reference to the overlay
        state.activeInputs.set(inputElement, {
          overlay,
          wrapper,
          mistakes
        });
      } 
    }
    
    /**
     * Helper function to escape HTML special characters
     */
    function escapeHtml(text) {
      // Replace spaces with non-breaking spaces to preserve spacing
      // and escape other HTML characters
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/ /g, '&nbsp;');
    }
  
    /**
     * Handle highlighting for contenteditable elements
     */
    function highlightContentEditableMistakes(element, mistakes) {
      // Clear existing highlights
      const highlightSpans = element.querySelectorAll(`.${config.cssPrefix}mistake`);
      highlightSpans.forEach(span => {
        const text = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(text, span);
      });
      
      if (mistakes.length === 0) return;
      
      // For simplicity, we'll use a basic approach that works for simple contenteditable elements
      // A more robust implementation would use a range-based approach
      let html = element.innerHTML;
      const textContent = element.textContent;
      
      // Sort mistakes by position (descending to avoid index shifting)
      mistakes.sort((a, b) => b.startIndex - a.startIndex);
      
      // Replace each mistake with a highlighted version
      for (const mistake of mistakes) {
        if (mistake.startIndex >= 0 && mistake.endIndex <= textContent.length) {
          const mistakeText = textContent.substring(mistake.startIndex, mistake.endIndex);
          
          // Get style based on mistake type
          const style = getMistakeStyle(mistake.type);
          
          // Find the mistake text in the HTML and wrap it with a highlight span
          // This is a simplified approach and may not work for complex HTML content
          html = html.replace(
            mistakeText,
            `<span class="${config.cssPrefix}mistake ${config.cssPrefix}${mistake.type}" 
                   style="${style}" 
                   title="${mistake.message || ''}">${mistakeText}</span>`
          );
        }
      }
      
      // Update the content
      element.innerHTML = html;
    }
  
    /**
     * Clear highlights for an input
     */
    function clearHighlights(inputElement) {
      const inputState = state.activeInputs.get(inputElement);
      if (inputState) {
        if (inputState.overlay) {
          inputState.overlay.remove();
        }
        // Don't remove the wrapper, just the overlay
      }
      state.activeInputs.set(inputElement, {});
    }
  
    /**
     * Handle input changes
     */
    const handleInputChange = debounce(function(event) {
      const inputElement = event.target;
      const text = inputElement.value || inputElement.innerText;
      checkSpelling(text, inputElement);
    }, config.debounceMs);
  
    /**
     * Attach spell checker to an input
     */
    function attachSpellChecker(inputElement) {
      // Skip if already attached
      if (state.activeInputs.has(inputElement)) return;
      
      // Initialize state for this input
      state.activeInputs.set(inputElement, {});
      
      // Attach event listeners
      if (inputElement.getAttribute('contenteditable') === 'true') {
        inputElement.addEventListener('input', handleInputChange);
      } else {
        inputElement.addEventListener('input', handleInputChange);
      }
    }
  
    /**
     * Reposition all overlays (after scroll/resize)
     */
    function repositionOverlays() {
      // With our new approach of wrapping inputs, we don't need to reposition overlays
      // since they're positioned relative to their parent containers.
      // However, we might need to update the content in case the input value has changed.
      
      for (const [inputElement, inputState] of state.activeInputs.entries()) {
        if (!inputState.overlay) continue;
        
        // If the value changes through a method other than user input
        // (e.g., programmatic change), we'll update the overlay
        const currentValue = inputElement.value || '';
        const currentMistakes = inputState.mistakes || [];
        
        // Re-highlight the mistakes if there are any
        if (currentMistakes.length > 0) {
          checkSpelling(currentValue, inputElement);
        }
      }
    }
  
    /**
     * Initialize the spell checker
     */
    function init() {
      // Find and attach to all matching inputs
      document.querySelectorAll(config.inputSelector).forEach(attachSpellChecker);
      
      // Set up a MutationObserver to watch for new inputs
      const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if the node itself is an input
                if (node.matches(config.inputSelector)) {
                  attachSpellChecker(node);
                }
                
                // Check children
                node.querySelectorAll(config.inputSelector).forEach(attachSpellChecker);
              }
            }
          }
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .${config.cssPrefix}spelling {
          text-decoration: underline wavy red;
        }
        .${config.cssPrefix}grammar {
          text-decoration: underline wavy blue;
        }
        .${config.cssPrefix}input-wrapper {
          position: relative;
          display: inline-block;
        }
        .${config.cssPrefix}overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
      `;
      document.head.appendChild(style);
      
      // Handle positioning changes (scrolling, resizing)
      window.addEventListener('scroll', repositionOverlays);
      window.addEventListener('resize', repositionOverlays);
    }
  
    // Define the SpellChecker object before calling any functions
    window.SpellChecker = {
      // Store for API responses (for testing)
      _lastApiResponse: null,
      
      // Check a specific element
      checkElement: function(element) {
        if (!element) return;
        attachSpellChecker(element);
        handleInputChange({ target: element });
      },
      
      // Process text manually without an element
      checkText: function(text) {
        if (!text) return Promise.resolve([]);
        
        return new Promise(async (resolve, reject) => {
          try {
            const headers = await prepareAuthHeaders();
            
            const fetchOptions = {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({ "content": text, "content_type": "text" }),
              credentials: 'include',
              mode: 'cors'
            };
            
            const response = await fetch(config.apiEndpoint, fetchOptions);
            
            if (!response.ok) {
              throw new Error(`API returned ${response.status}`);
            }
            
            const data = await response.json();
            state.lastApiResponse = data;
            const parsedMistakes = parseApiResponse(data);
            resolve(parsedMistakes);
          } catch (error) {
            console.error('Spell check failed:', error);
            reject(error);
          }
        });
      },
      
      // Update configuration
      configure: function(newConfig) {
        // Handle nested object updates
        if (newConfig.auth) {
          Object.assign(config.auth, newConfig.auth);
          delete newConfig.auth; // Remove to avoid overriding the entire auth object
        }
        
        if (newConfig.cssOverrides) {
          Object.assign(config.cssOverrides, newConfig.cssOverrides);
          delete newConfig.cssOverrides; // Remove to avoid overriding entire cssOverrides
        }
        
        // Update the rest of the config
        Object.assign(config, newConfig);
      },
      
      // Enable debug mode
      enableDebug: function() {
        config.debug = true;
        console.log('SpellChecker debug mode enabled');
      },
      
      // Test API connection
      testConnection: async function() {
        try {
          const headers = await prepareAuthHeaders();
          
          const fetchOptions = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ "content": "Test connection", "content_type": "text" }),
            credentials: 'include', // Always include credentials
            mode: 'cors' // Explicitly set CORS mode
          };
          
          console.log('Testing connection with options:', {
            url: config.apiEndpoint,
            options: {
              ...fetchOptions,
              headers: { ...fetchOptions.headers }
            }
          });
          
          console.log('Document cookies:', document.cookie);
          
          // List cookies that would be sent with this request
          const cookieNames = document.cookie.split(';').map(cookie => 
            cookie.trim().split('=')[0]
          );
          console.log('Cookie names available:', cookieNames);
          
          const response = await fetch(config.apiEndpoint, fetchOptions);
          
          console.log('Response status:', response.status);
          if (response.ok) {
            const data = await response.json();
            console.log('Connection test successful:', data);
            return { success: true, data };
          } else {
            console.error('Connection test failed with status:', response.status);
            return { success: false, status: response.status };
          }
        } catch (error) {
          console.error('Connection test failed with error:', error);
          return { success: false, error: error.message };
        }
      }
    };
  
    // Initialize the spell checker
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
})();
