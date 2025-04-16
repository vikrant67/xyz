/**
 * Cross-Framework Spell Checker
 * This vanilla JS script can be added to any frontend to provide spell checking capabilities.
 */

(function() {
    // Configuration (can be customized for each deployment)
    const config = {
      apiEndpoint: 'https://your-api.example.com/spell-check',
      debounceMs: 500,
      inputSelector: 'input[type="text"], textarea, [contenteditable="true"]',
      authTokenRetrievers: {
        // Function to extract token from Cognito
        cognito: function() {
          try {
            // Try to get the JWT from localStorage or sessionStorage
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
            // If Firebase SDK is available
            if (window.firebase && firebase.auth) {
              const currentUser = firebase.auth().currentUser;
              if (currentUser) {
                return currentUser.getIdToken(true);
              }
            }
            // Alternative: check localStorage
            return localStorage.getItem('firebaseAuthToken');
          } catch (e) {
            console.error('Failed to retrieve Firebase token:', e);
            return null;
          }
        },
        // Add more auth mechanisms as needed
      },
      // Detect which auth method to use based on available globals or other signals
      detectAuthMethod: function() {
        if (window.firebase) return 'firebase';
        if (window.AmazonCognitoIdentity || 
            document.querySelector('[data-auth="cognito"]')) return 'cognito';
        return null; // No auth or unknown
      },
      cssPrefix: 'spellcheck-'
    };
  
    // State management
    const state = {
      activeInputs: new Map(), // Map of inputs to their current state
      currentAuthMethod: null
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
     * Get the authentication token based on detected method
     */
    async function getAuthToken() {
      if (!state.currentAuthMethod) {
        state.currentAuthMethod = config.detectAuthMethod();
      }
      
      if (!state.currentAuthMethod) {
        console.warn('No authentication method detected');
        return null;
      }
      
      const retriever = config.authTokenRetrievers[state.currentAuthMethod];
      if (!retriever) {
        console.error(`No token retriever for auth method: ${state.currentAuthMethod}`);
        return null;
      }
      
      // Handle if the retriever returns a promise
      const token = retriever();
      return token instanceof Promise ? await token : token;
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
        const token = await getAuthToken();
        
        const response = await fetch(config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ text })
        });
  
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
  
        const data = await response.json();
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
        
        // Add the mistake with highlight
        html += `<span class="${config.cssPrefix}mistake" style="text-decoration: underline wavy red;">${
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
      // Implementation for contenteditable elements would go here
      // This is more complex as we need to work with the DOM nodes
      console.log('Contenteditable spell checking not yet implemented');
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
      
      // Handle positioning changes (scrolling, resizing)
      window.addEventListener('scroll', function() {
        repositionOverlays();
      });
      window.addEventListener('resize', function() {
        repositionOverlays();
      });
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
    }
  
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
    // Expose public API
    window.SpellChecker = {
      checkElement: function(element) {
        if (!element) return;
        attachSpellChecker(element);
        handleInputChange({ target: element });
      },
      configure: function(newConfig) {
        Object.assign(config, newConfig);
      }
    };
  })();
