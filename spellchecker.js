/**
 * Cross-Framework Spell Checker with Cookie Authentication
 * This vanilla JS script can be added to any frontend to provide spell checking capabilities.
 */

(function() {
    // Configuration (can be customized for each deployment)
    const config = {
      apiEndpoint: 'http://localhost:8080/spell-check',
      debounceMs: 500,
      inputSelector: 'input[type="text"], textarea, [contenteditable="true"]',
      // Authentication configuration
      auth: {
        // Set to true to use cookie-based authentication (credentials: 'include')
        useCookies: true,
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
        mistakeStyle: 'text-decoration: underline wavy red;'
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
     * Call the spell check API
     */
    async function checkSpelling(text, inputElement) {
      if (!text || text.trim() === '') {
        clearHighlights(inputElement);
        return;
      }
  
      try {
        const headers = await prepareAuthHeaders();
        
        const fetchOptions = {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ text })
        };
        
        // Include credentials if using cookie authentication
        if (config.auth.useCookies) {
          fetchOptions.credentials = 'include';
        }
        
        const response = await fetch(config.apiEndpoint, fetchOptions);
  
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
  
        const data = await response.json();
        
        // For testing - store the last API response in our state
        state.lastApiResponse = data;
        // Make the response available on the SpellChecker object
        if (window.SpellChecker) {
          window.SpellChecker._lastApiResponse = data;
        }
        
        highlightMistakes(inputElement, data.mistakes || []);
      } catch (error) {
        console.error('Spell check failed:', error);
        // Optionally, provide visual feedback about the error
      }
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
      
      // Create overlay for highlighting (positioned absolutely over the input)
      const inputRect = inputElement.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = `${config.cssPrefix}overlay`;
      overlay.style.position = 'absolute';
      overlay.style.left = `${inputRect.left + window.scrollX}px`;
      overlay.style.top = `${inputRect.top + window.scrollY}px`;
      overlay.style.width = `${inputRect.width}px`;
      overlay.style.height = `${inputRect.height}px`;
      overlay.style.pointerEvents = 'none'; // Allow clicking through
      overlay.style.zIndex = '9999';
      
      // Clone text content
      const textContainer = document.createElement('div');
      textContainer.style.position = 'relative';
      textContainer.style.fontFamily = window.getComputedStyle(inputElement).fontFamily;
      textContainer.style.fontSize = window.getComputedStyle(inputElement).fontSize;
      textContainer.style.padding = window.getComputedStyle(inputElement).padding;
      
      // Create text with highlights
      let text = inputElement.value || '';
      let html = '';
      let lastIndex = 0;
      
      // Sort mistakes by position
      mistakes.sort((a, b) => a.startIndex - b.startIndex);
      
      for (const mistake of mistakes) {
        // Add text before the mistake
        html += text.substring(lastIndex, mistake.startIndex);
        
        // Add the mistake with highlight (using custom style if provided)
        html += `<span class="${config.cssPrefix}mistake" style="${config.cssOverrides.mistakeStyle}">${
          text.substring(mistake.startIndex, mistake.endIndex)
        }</span>`;
        
        lastIndex = mistake.endIndex;
      }
      
      // Add any remaining text
      html += text.substring(lastIndex);
      
      textContainer.innerHTML = html;
      overlay.appendChild(textContainer);
      document.body.appendChild(overlay);
      
      // Store reference to the overlay
      state.activeInputs.set(inputElement, {
        overlay,
        mistakes
      });
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
          
          // Find the mistake text in the HTML and wrap it with a highlight span
          // This is a simplified approach and may not work for complex HTML content
          html = html.replace(
            mistakeText,
            `<span class="${config.cssPrefix}mistake" style="${config.cssOverrides.mistakeStyle}">${mistakeText}</span>`
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
      if (inputState && inputState.overlay) {
        inputState.overlay.remove();
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
      for (const [inputElement, inputState] of state.activeInputs.entries()) {
        if (!inputState.overlay) continue;
        
        const inputRect = inputElement.getBoundingClientRect();
        inputState.overlay.style.left = `${inputRect.left + window.scrollX}px`;
        inputState.overlay.style.top = `${inputRect.top + window.scrollY}px`;
        inputState.overlay.style.width = `${inputRect.width}px`;
        inputState.overlay.style.height = `${inputRect.height}px`;
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
        .${config.cssPrefix}mistake {
          text-decoration: underline wavy red;
        }
      `;
      document.head.appendChild(style);
      
      // Handle positioning changes (scrolling, resizing)
      window.addEventListener('scroll', repositionOverlays);
      window.addEventListener('resize', repositionOverlays);
    }
  
    // IMPORTANT: First define the SpellChecker object before calling any functions
    // that might try to access it
    window.SpellChecker = {
      // Store for API responses (for testing)
      _lastApiResponse: null,
      
      // Check a specific element
      checkElement: function(element) {
        if (!element) return;
        attachSpellChecker(element);
        handleInputChange({ target: element });
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
      }
    };
  
    // NOW initialize the spell checker
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
