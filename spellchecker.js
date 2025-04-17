/**
     * Generate a unique ID for input elements that don't have one
     */
    function generateInputId(inputElement) {
      const id = `spellcheck-input-${Math.random().toString(36).substring(2, 11)}`;
      inputElement.dataset.spellcheckId = id;
      return id;
    }
    
    /**
     * Handle clicks on mistake spans
     */
    function handleMistakeClick(event) {
      event.stopPropagation();
      
      const mistakeSpan = event.currentTarget;
      const rect = mistakeSpan.getBoundingClientRect();
      
      // Extract data from span
      const mistakeType = mistakeSpan.dataset.mistakeType;
      const mistakeCode = mistakeSpan.dataset.mistakeCode;
      const mistakeText = mistakeSpan.dataset.mistakeText;
      const mistakeMessage = mistakeSpan.dataset.mistakeMessage;
      const suggestions = mistakeSpan.dataset.mistakeSuggestions ? 
                           mistakeSpan.dataset.mistakeSuggestions.split(',') : [];
      const startIndex = parseInt(mistakeSpan.dataset.mistakeStart);
      const endIndex = parseInt(mistakeSpan.dataset.mistakeEnd);
      const inputId = mistakeSpan.dataset.inputId;
      
      // Find associated input element
      let inputElement = document.getElementById(inputId);
      if (!inputElement) {
        // Try to find by data attribute if id wasn't found
        inputElement = document.querySelector(`[data-spellcheck-id="${inputId}"]`);
      }
      
      // Create correction popup
      createCorrectionPopup({
        mistakeType,
        mistakeCode,
        mistakeText,
        mistakeMessage,
        suggestions,
        position: {
          left: rect.left,
          top: rect.bottom + 5, // Position below the text
          width: rect.width
        },
        onCorrect: (correction) => {
          // Apply correction to input if we found it
          if (inputElement) {
            const currentValue = inputElement.value;
            const newValue = currentValue.substring(0, startIndex) + 
                             correction + 
                             currentValue.substring(endIndex);
            
            // Update input value
            inputElement.value = newValue;
            
            // Trigger input event to update UI
            const event = new Event('input', { bubbles: true });
            inputElement.dispatchEvent(event);
            
            // Focus the input and set cursor position after correction
            inputElement.focus();
            inputElement.setSelectionRange(startIndex + correction.length, startIndex + correction.length);
          }
          
          // Close popup
          closeCorrectionPopup();
        },
        onIgnore: () => {
          // Just close the popup
          closeCorrectionPopup();
        }
      });
    }
    
    /**
     * Create and display a correction popup
     */
    function createCorrectionPopup(options) {
      // Close any existing popup
      closeCorrectionPopup();
      
      // Create popup container
      const popup = document.createElement('div');
      popup.className = `${config.cssPrefix}correction-popup`;
      popup.style.position = 'fixed';
      popup.style.left = `${options.position.left}px`;
      popup.style.top = `${options.position.top}px`;
      popup.style.minWidth = '280px';
      popup.style.maxWidth = '320px';
      popup.style.backgroundColor = '#f8f9fa';
      popup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      popup.style.borderRadius = '8px';
      popup.style.zIndex = '10000000';
      popup.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      popup.style.fontSize = '14px';
      popup.style.overflow = 'hidden';
      
      // Create header section
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.style.padding = '12px 16px';
      header.style.borderBottom = '1px solid rgba(0, 0, 0, 0.1)';
      header.style.backgroundColor = '#f0f0f0';
      
      // Add icon and title
      const headerTitle = document.createElement('div');
      headerTitle.style.display = 'flex';
      headerTitle.style.alignItems = 'center';
      headerTitle.style.gap = '8px';
      
      // Create icon based on mistake type
      const icon = document.createElement('span');
      icon.style.display = 'inline-flex';
      icon.style.alignItems = 'center';
      icon.style.justifyContent = 'center';
      icon.style.width = '24px';
      icon.style.height = '24px';
      icon.style.borderRadius = '50%';
      icon.style.backgroundColor = '#333';
      icon.style.color = '#fff';
      icon.style.fontSize = '14px';
      
      // Depending on the mistakeType, use different icons
      if (options.mistakeType === 'grammar') {
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"></path><path d="M9 20h6"></path><path d="M12 4v16"></path></svg>';
      } else {
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
      }
      
      const title = document.createElement('span');
      title.textContent = options.mistakeType === 'grammar' ? 'Grammar' : 'Spelling';
      title.style.fontWeight = 'bold';
      
      headerTitle.appendChild(icon);
      headerTitle.appendChild(title);
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.cursor = 'pointer';
      closeButton.style.fontSize = '20px';
      closeButton.style.color = '#333';
      closeButton.style.padding = '0';
      closeButton.style.width = '24px';
      closeButton.style.height = '24px';
      closeButton.style.display = 'flex';
      closeButton.style.alignItems = 'center';
      closeButton.style.justifyContent = 'center';
      closeButton.addEventListener('click', closeCorrectionPopup);
      
      header.appendChild(headerTitle);
      header.appendChild(closeButton);
      
      // Create content section
      const content = document.createElement('div');
      content.style.padding = '16px';
      
      // Add error message
      const message = document.createElement('p');
      message.textContent = options.mistakeMessage || 'Please check this text.';
      message.style.margin = '0 0 16px 0';
      message.style.color = '#333';
      content.appendChild(message);
      
      // Add suggestions
      if (options.suggestions && options.suggestions.length > 0) {
        // Create buttons for first suggestion, plus ignore button
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '8px';
        
        // Create suggestion button (first suggestion)
        const suggestionBtn = document.createElement('button');
        suggestionBtn.textContent = options.suggestions[0];
        suggestionBtn.style.backgroundColor = '#4285f4';
        suggestionBtn.style.color = 'white';
        suggestionBtn.style.border = 'none';
        suggestionBtn.style.borderRadius = '4px';
        suggestionBtn.style.padding = '8px 16px';
        suggestionBtn.style.cursor = 'pointer';
        suggestionBtn.style.fontWeight = '500';
        suggestionBtn.addEventListener('click', () => {
          if (options.onCorrect) options.onCorrect(options.suggestions[0]);
        });
        
        // Create ignore button
        const ignoreBtn = document.createElement('button');
        ignoreBtn.textContent = 'Ignore';
        ignoreBtn.style.backgroundColor = '#f1f3f4';
        ignoreBtn.style.color = '#333';
        ignoreBtn.style.border = 'none';
        ignoreBtn.style.borderRadius = '4px';
        ignoreBtn.style.padding = '8px 16px';
        ignoreBtn.style.cursor = 'pointer';
        ignoreBtn.style.fontWeight = '500';
        ignoreBtn.addEventListener('click', () => {
          if (options.onIgnore) options.onIgnore();
        });
        
        buttonsContainer.appendChild(suggestionBtn);
        buttonsContainer.appendChild(ignoreBtn);
        content.appendChild(buttonsContainer);
        
        // If there are more suggestions, add them in a separate section
        if (options.suggestions.length > 1) {
          const moreSuggestions = document.createElement('div');
          moreSuggestions.style.marginTop = '12px';
          
          // Add a subtle divider
          const divider = document.createElement('div');
          divider.style.height = '1px';
          divider.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
          divider.style.margin = '12px 0';
          moreSuggestions.appendChild(divider);
          
          // Container for additional suggestions
          const suggestionsList = document.createElement('div');
          suggestionsList.style.display = 'flex';
          suggestionsList.style.gap = '8px';
          suggestionsList.style.flexWrap = 'wrap';
          
          // Skip the first suggestion as it's already in the main button
          for (let i = 1; i < Math.min(5, options.suggestions.length); i++) {
            const chip = document.createElement('button');
            chip.textContent = options.suggestions[i];
            chip.style.backgroundColor = '#f1f3f4';
            chip.style.color = '#333';
            chip.style.border = 'none';
            chip.style.borderRadius = '4px';
            chip.style.padding = '6px 12px';
            chip.style.cursor = 'pointer';
            chip.style.fontSize = '13px';
            chip.addEventListener('click', () => {
              if (options.onCorrect) options.onCorrect(options.suggestions[i]);
            });
            suggestionsList.appendChild(chip);
          }
          
          moreSuggestions.appendChild(suggestionsList);
          content.appendChild(moreSuggestions);
        }
      }
      
      // Assemble popup
      popup.appendChild(header);
      popup.appendChild(content);
      
      // Add popup to document
      document.body.appendChild(popup);
      
      // Store reference to current popup
      window.currentCorrectionPopup = popup;
      
      // Add click outside to close
      setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
      }, 10);
    }
    
    /**
     * Close the correction popup
     */
    function closeCorrectionPopup() {
      if (window.currentCorrectionPopup) {
        window.currentCorrectionPopup.remove();
        window.currentCorrectionPopup = null;
      }
      
      document.removeEventListener('click', handleOutsideClick);
    }
    
    /**
     * Handle clicks outside the popup to close it
     */
    function handleOutsideClick(event) {
      const popup = window.currentCorrectionPopup;
      if (popup && !popup.contains(event.target) && 
          !event.target.classList.contains(`${config.cssPrefix}mistake`)) {
        closeCorrectionPopup();
      }
    }/**
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

      // APPROACH: Create a custom overlay that mimics the input position perfectly
      // but doesn't modify the DOM structure around the input
      
      const inputRect = inputElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(inputElement);
      
      // Create the overlay container
      const overlay = document.createElement('div');
      overlay.className = `${config.cssPrefix}overlay`;
      overlay.style.position = 'fixed'; // Fixed position relative to viewport
      overlay.style.left = `${inputRect.left}px`;
      overlay.style.top = `${inputRect.top}px`;
      overlay.style.width = `${inputRect.width}px`;
      overlay.style.height = `${inputRect.height}px`;
      overlay.style.pointerEvents = 'none'; // Will change this for clickable spans
      overlay.style.zIndex = '999999'; // High z-index to stay on top
      overlay.style.overflow = 'hidden';
      
      // Create the text container that will hold our highlighted text
      const textContainer = document.createElement('div');
      textContainer.className = `${config.cssPrefix}text-container`;
      textContainer.style.position = 'absolute';
      textContainer.style.top = '0';
      textContainer.style.left = '0';
      textContainer.style.width = '100%';
      textContainer.style.height = '100%';
      textContainer.style.boxSizing = 'border-box';
      textContainer.style.fontFamily = computedStyle.fontFamily;
      textContainer.style.fontSize = computedStyle.fontSize;
      textContainer.style.fontWeight = computedStyle.fontWeight;
      textContainer.style.letterSpacing = computedStyle.letterSpacing;
      textContainer.style.lineHeight = computedStyle.lineHeight;
      textContainer.style.whiteSpace = 'pre';
      textContainer.style.overflow = 'hidden';
      textContainer.style.textAlign = computedStyle.textAlign;
      
      // Add padding to match the input's padding
      textContainer.style.paddingTop = computedStyle.paddingTop;
      textContainer.style.paddingRight = computedStyle.paddingRight;
      textContainer.style.paddingBottom = computedStyle.paddingBottom;
      textContainer.style.paddingLeft = computedStyle.paddingLeft;
      
      // Add border to match the input's border (for positioning)
      textContainer.style.borderTopWidth = computedStyle.borderTopWidth;
      textContainer.style.borderRightWidth = computedStyle.borderRightWidth;
      textContainer.style.borderBottomWidth = computedStyle.borderBottomWidth;
      textContainer.style.borderLeftWidth = computedStyle.borderLeftWidth;
      textContainer.style.borderStyle = 'solid';
      textContainer.style.borderColor = 'transparent';
      
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
        
        // Add the mistake with highlight - make it clickable with data attributes
        html += `<span 
                  class="${config.cssPrefix}mistake ${config.cssPrefix}${mistake.type}" 
                  style="${style}; cursor: pointer;" 
                  data-mistake-type="${mistake.type}"
                  data-mistake-code="${mistake.code || ''}"
                  data-mistake-text="${escapeHtml(text.substring(mistake.startIndex, mistake.endIndex))}"
                  data-mistake-message="${mistake.message || ''}"
                  data-mistake-suggestions="${(mistake.suggestions || []).join(',')}"
                  data-mistake-start="${mistake.startIndex}"
                  data-mistake-end="${mistake.endIndex}"
                  data-input-id="${inputElement.id || generateInputId(inputElement)}"
                >${
          escapeHtml(text.substring(mistake.startIndex, mistake.endIndex))
        }</span>`;
        
        lastIndex = mistake.endIndex;
      }
      
      // Add any remaining text and replace spaces with &nbsp; to maintain spacing
      html += escapeHtml(text.substring(lastIndex));
      
      // Set content
      textContainer.innerHTML = html;
      overlay.appendChild(textContainer);
      document.body.appendChild(overlay);
      
      // Enable pointer events only on mistake spans
      const mistakeSpans = textContainer.querySelectorAll(`.${config.cssPrefix}mistake`);
      mistakeSpans.forEach(span => {
        span.style.pointerEvents = 'auto';
        span.addEventListener('click', handleMistakeClick);
      });
      
      // Store reference to the overlay
      state.activeInputs.set(inputElement, {
        overlay,
        mistakes,
        inputRect: {
          left: inputRect.left,
          top: inputRect.top,
          width: inputRect.width,
          height: inputRect.height
        }
      });
      
      // Add scroll event listener to update position on scroll
      if (!window._spellcheckScrollHandler) {
        window._spellcheckScrollHandler = true;
        window.addEventListener('scroll', updateFixedOverlayPositions, { passive: true });
      }
    }
    
    /**
     * Update positions of all fixed overlays on scroll
     */
    function updateFixedOverlayPositions() {
      for (const [inputElement, inputState] of state.activeInputs.entries()) {
        if (!inputState.overlay) continue;
        
        const inputRect = inputElement.getBoundingClientRect();
        
        // Update the overlay position
        inputState.overlay.style.left = `${inputRect.left}px`;
        inputState.overlay.style.top = `${inputRect.top}px`;
        
        // Store the new rect
        inputState.inputRect = {
          left: inputRect.left,
          top: inputRect.top,
          width: inputRect.width,
          height: inputRect.height
        };
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
      updateFixedOverlayPositions();
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
          cursor: pointer;
        }
        .${config.cssPrefix}grammar {
          text-decoration: underline wavy blue;
          cursor: pointer;
        }
        .${config.cssPrefix}overlay {
          position: fixed;
          pointer-events: none;
          z-index: 999999;
        }
        .${config.cssPrefix}text-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }
        .${config.cssPrefix}mistake {
          position: relative;
          pointer-events: auto;
        }
        .${config.cssPrefix}correction-popup {
          animation: ${config.cssPrefix}fadeIn 0.2s ease-out;
        }
        @keyframes ${config.cssPrefix}fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
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
