// app/page.tsx
"use client";

import React, { useEffect, useRef } from 'react'; // useRef can be useful if needed
import Script from 'next/script';
import Head from 'next/head';

// Declare Hls for global scope if loaded via <script>
declare global {
    var Hls: any; // Use 'any' for simplicity, or install @types/hls.js for better typing
}


export default function HomePage() { // Renamed component to HomePage for clarity

  // Main effect hook
  useEffect(() => {
    console.log("[Client] Home Page (IPTV) Effect Running"); // Updated log message

    // --- DOM Element Access ---
    // Helper function for getting elements with type casting
    const getElementById = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

    // Use specific types where possible
    const loginScreen = getElementById<HTMLDivElement>('loginScreen');
    const app = getElementById<HTMLDivElement>('app');
    const loginForm = getElementById<HTMLFormElement>('loginForm');
    const loginError = getElementById<HTMLDivElement>('loginError');
    const loginErrorText = getElementById<HTMLSpanElement>('loginErrorText');
    const serverInfo = getElementById<HTMLParagraphElement>('serverInfo');
    const sectionBtnsNodeList = document.querySelectorAll('.section-btn'); // NodeListOf<Element>
    const searchInput = getElementById<HTMLInputElement>('searchInput');
    const favoritesBtn = getElementById<HTMLButtonElement>('favoritesBtn');
    const logoutBtn = getElementById<HTMLButtonElement>('logoutBtn');
    const categoryContainer = getElementById<HTMLDivElement>('categoryContainer');
    const contentGrid = getElementById<HTMLDivElement>('contentGrid');
    const gridLoadingState = getElementById<HTMLDivElement>('gridLoadingState');
    const noResultsState = getElementById<HTMLDivElement>('noResultsState');
    const playerModal = getElementById<HTMLDivElement>('playerModal');
    const modalContent = getElementById<HTMLDivElement>('modalContent');
    const modalTitle = getElementById<HTMLHeadingElement>('modalTitle');
    const modalCloseBtn = getElementById<HTMLButtonElement>('modalCloseBtn');
    const modalVideoContainer = getElementById<HTMLDivElement>('modalVideoContainer');
    const videoPlayer = getElementById<HTMLVideoElement>('videoPlayer');
    const playerError = getElementById<HTMLDivElement>('playerError');
    const playerErrorText = getElementById<HTMLSpanElement>('playerErrorText');
    const playerLoading = getElementById<HTMLDivElement>('playerLoading');
    const modalSeriesInfo = getElementById<HTMLDivElement>('modalSeriesInfo');
    const rememberMeCheckbox = getElementById<HTMLInputElement>('rememberMe');
    const modalFavoriteBtn = getElementById<HTMLButtonElement>('modalFavoriteBtn');

    // --- App State Variables ---
    let allContent: { live: any[], vod: any[], series: any[] } = { live: [], vod: [], series: [] }; // FIX: Correct array type syntax
    let categories: { live: any[], vod: any[], series: any[] } = { live: [], vod: [], series: [] }; // FIX: Correct array type syntax
    let favorites: { [key: string]: (string | number)[] } = { live: [], vod: [], series: [] }; // FIX: Correct array type syntax & more specific typing
    let currentStream: any = null;
    let currentEpisode: any = null;
    let hls: any = null; // Hls instance
    let credentials: { serverUrl?: string, username?: string, password?: string, remember?: boolean } = {};
    let currentContentType = 'vod';
    let currentFilter: { type: string, id?: string | null, query?: string } = { type: 'category', id: 'all' };
    let isFavoritesMode = false;
    let currentSubtitles: { tracks: any[], currentTrack: number | null } = { tracks: [], currentTrack: null }; // For subtitle support

    const PLACEHOLDER_POSTER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMjAwIDMwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzM3NDE1MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDJkNmQwIiBmb250LXNpemU9IjIwcHgiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
    const CREDENTIALS_STORAGE_KEY = 'xtreme_player_credentials';

    // --- Helper Functions ---

    const fetchViaProxy = async (action: string, params = {}) => {
        console.log(`[Client] Calling fetchViaProxy for action: ${action}`, params);
        if (!credentials.serverUrl || !credentials.username || !credentials.password) {
            console.error("[Client] Missing credentials for fetchViaProxy");
            throw new Error("Missing credentials for API call");
        }
        const response = await fetch('/api/iptv-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverUrl: credentials.serverUrl,
                username: credentials.username,
                password: credentials.password,
                action: action,
                params: params,
            }),
        });

        console.log(`[Client] Proxy response status for action ${action}: ${response.status}`);
        const data = await response.json(); // Always attempt to parse JSON

        if (!response.ok) {
            console.error(`[Client] Proxy returned error for action ${action}:`, data);
            // Extract meaningful error from proxy response if possible
            const errorDetail = data?.details?.message || data?.details?.raw || data?.details || data?.error || `Proxy request failed with status: ${response.status}`;
            throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
        }

        console.log(`[Client] Proxy response data for action ${action}: OK`); // Don't log full data here usually
        return data;
    };

    const isHlsSupported = () => typeof Hls !== 'undefined' && Hls.isSupported();

    const initPlayer = () => {
        destroyHlsInstance();
        if (isHlsSupported() && videoPlayer) { // Check videoPlayer exists
            console.log("[Client] Initializing HLS Player");
            const hlsConfig = {
                debug: true, // Enable debug for troubleshooting subtitles
                // Enable subtitle support
                enableWebVTT: true,
                enableCEA708Captions: true,
                // Force subtitle display
                renderTextTracksNatively: false,
                // Add other HLS config options as needed
            };
            hls = new Hls(hlsConfig);
            hls.on(Hls.Events.MANIFEST_PARSED, (event: any, data: any) => { 
                showPlayerLoading(false); 
                videoPlayer.play().catch(handlePlaybackError);
                
                // Handle subtitles if available
                handleSubtitles(event, data);
            });
            hls.on(Hls.Events.LEVEL_LOADED, () => { showPlayerLoading(false); });
            hls.on(Hls.Events.FRAG_BUFFERED, () => { if (videoPlayer?.error === null) { showPlayerLoading(false); } });
            hls.on(Hls.Events.ERROR, handleHlsError); // Keep handleHlsError separate
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, handleSubtitleTracksUpdated);
            hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, handleSubtitleTrackSwitch);
            hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, () => console.log("[Client] Subtitle track loaded"));
        } else if (videoPlayer) {
            console.log("[Client] HLS.js not supported or not loaded yet, or video element missing.");
        }
    };
    
    const handleSubtitles = (event: any, data: any) => {
        // Reset subtitle state
        currentSubtitles = { tracks: [], currentTrack: null };
        
        // Check if subtitles are available
        if (hls && data && data.subtitleTracks && data.subtitleTracks.length > 0) {
            console.log("[Client] Subtitles available:", data.subtitleTracks);
            
            // Store subtitle tracks
            currentSubtitles.tracks = data.subtitleTracks;
            
            // Create subtitle control UI
            createSubtitleControl();
        } else {
            console.log("[Client] No subtitles available in this stream");
            // Remove subtitle control if it exists
            const subtitleControl = document.getElementById('subtitleControl');
            if (subtitleControl) subtitleControl.remove();
        }
    };
    
    const handleSubtitleTracksUpdated = (event: any, data: any) => {
        console.log("[Client] Subtitle tracks updated:", data.subtitleTracks);
        if (data.subtitleTracks && data.subtitleTracks.length > 0) {
            currentSubtitles.tracks = data.subtitleTracks;
            createSubtitleControl();
        }
    };
    
    const handleSubtitleTrackSwitch = (event: any, data: any) => {
        console.log("[Client] Subtitle track switched:", data);
        currentSubtitles.currentTrack = data.id;
        updateSubtitleControlState();
    };
    
    const createSubtitleControl = () => {
        console.log("[Client] Creating subtitle control with tracks:", currentSubtitles.tracks);
        
        // Remove existing control if it exists
        const existingControl = document.getElementById('subtitleControl');
        if (existingControl) existingControl.remove();
        
        if (!modalVideoContainer) {
            console.error("[Client] Cannot create subtitle control: modalVideoContainer is null");
            return;
        }
        
        if (currentSubtitles.tracks.length === 0) {
            console.log("[Client] No subtitle tracks available, not creating control");
            return;
        }
        
        // Create subtitle control container
        const subtitleControl = document.createElement('div');
        subtitleControl.id = 'subtitleControl';
        subtitleControl.style.position = 'absolute';
        subtitleControl.style.bottom = '4rem';
        subtitleControl.style.right = '1rem';
        subtitleControl.style.backgroundColor = 'rgba(31, 41, 55, 0.8)';
        subtitleControl.style.borderRadius = '0.5rem';
        subtitleControl.style.padding = '0.5rem';
        subtitleControl.style.zIndex = '30';
        subtitleControl.style.display = 'flex';
        subtitleControl.style.alignItems = 'center';
        
        // Create subtitle icon
        const subtitleIcon = document.createElement('button');
        subtitleIcon.style.color = 'white';
        subtitleIcon.style.marginRight = '0.5rem';
        subtitleIcon.innerHTML = '<i class="fas fa-closed-captioning"></i>';
        subtitleIcon.title = 'Subtitles';
        subtitleIcon.onclick = toggleSubtitleMenu;
        
        // Create subtitle dropdown
        const subtitleDropdown = document.createElement('div');
        subtitleDropdown.id = 'subtitleDropdown';
        subtitleDropdown.style.position = 'absolute';
        subtitleDropdown.style.bottom = '100%';
        subtitleDropdown.style.right = '0';
        subtitleDropdown.style.marginBottom = '0.5rem';
        subtitleDropdown.style.backgroundColor = 'rgb(31, 41, 55)';
        subtitleDropdown.style.borderRadius = '0.5rem';
        subtitleDropdown.style.padding = '0.5rem';
        subtitleDropdown.style.minWidth = '150px';
        subtitleDropdown.style.zIndex = '30';
        subtitleDropdown.style.display = 'none'; // Initially hidden
        
        // Add "Off" option
        const offOption = document.createElement('div');
        offOption.className = 'subtitle-option';
        offOption.style.color = 'white';
        offOption.style.padding = '0.25rem 0.75rem';
        offOption.style.borderRadius = '0.25rem';
        offOption.style.cursor = 'pointer';
        offOption.style.whiteSpace = 'nowrap';
        offOption.style.transition = 'background-color 0.2s ease';
        offOption.textContent = 'Off';
        offOption.dataset.id = '-1';
        offOption.onclick = () => selectSubtitleTrack(-1);
        subtitleDropdown.appendChild(offOption);
        
        // Add available subtitle tracks
        currentSubtitles.tracks.forEach((track, index) => {
            const option = document.createElement('div');
            option.className = 'subtitle-option';
            option.style.color = 'white';
            option.style.padding = '0.25rem 0.75rem';
            option.style.borderRadius = '0.25rem';
            option.style.cursor = 'pointer';
            option.style.whiteSpace = 'nowrap';
            option.style.transition = 'background-color 0.2s ease';
            option.textContent = track.name || `Subtitle ${index + 1}`;
            option.dataset.id = String(track.id);
            option.onclick = () => selectSubtitleTrack(track.id);
            subtitleDropdown.appendChild(option);
        });
        
        // Assemble the control
        subtitleControl.appendChild(subtitleIcon);
        subtitleControl.appendChild(subtitleDropdown);
        
        // Add to video container
        modalVideoContainer.appendChild(subtitleControl);
        console.log("[Client] Subtitle control added to video container");
        
        // Update state
        updateSubtitleControlState();
    };
    
    const toggleSubtitleMenu = () => {
        console.log("[Client] Toggling subtitle menu");
        const dropdown = document.getElementById('subtitleDropdown');
        if (dropdown) {
            // Toggle between display: none and display: block
            if (dropdown.style.display === 'none' || dropdown.style.display === '') {
                dropdown.style.display = 'block';
                console.log("[Client] Subtitle dropdown shown");
            } else {
                dropdown.style.display = 'none';
                console.log("[Client] Subtitle dropdown hidden");
            }
        } else {
            console.error("[Client] Subtitle dropdown element not found");
        }
    };
    
    const selectSubtitleTrack = (id: number) => {
        console.log(`[Client] Selecting subtitle track: ${id}`);
        if (hls) {
            if (id === -1) {
                // Turn off subtitles
                hls.subtitleTrack = -1;
                currentSubtitles.currentTrack = null;
            } else {
                // Enable selected subtitle track
                hls.subtitleTrack = id;
                currentSubtitles.currentTrack = id;
            }
            
            // Hide dropdown after selection
            const dropdown = document.getElementById('subtitleDropdown');
            if (dropdown) dropdown.style.display = 'none';
            
            // Update UI
            updateSubtitleControlState();
        }
    };
    
    const updateSubtitleControlState = () => {
        console.log("[Client] Updating subtitle control state, current track:", currentSubtitles.currentTrack);
        const subtitleOptions = document.querySelectorAll('.subtitle-option');
        subtitleOptions.forEach(option => {
            const el = option as HTMLElement;
            const optionId = el.dataset.id === '-1' ? -1 : parseInt(el.dataset.id || '-1');
            const isActive = currentSubtitles.currentTrack === optionId;
            
            // Use inline styles instead of classes
            if (isActive) {
                el.style.backgroundColor = 'rgb(37, 99, 235)'; // blue-600
                el.style.fontWeight = 'bold';
            } else {
                el.style.backgroundColor = 'transparent';
                el.style.fontWeight = 'normal';
            }
        });
        
        // Update icon color based on whether subtitles are active
        const subtitleIcon = document.querySelector('#subtitleControl button');
        if (subtitleIcon) {
            const isSubtitleActive = currentSubtitles.currentTrack !== null && currentSubtitles.currentTrack !== -1;
            (subtitleIcon as HTMLElement).style.color = isSubtitleActive ? 'rgb(96, 165, 250)' : 'white'; // blue-400 or white
        }
    };

    const destroyHlsInstance = () => {
        if (hls) {
            console.log("[Client] Destroying HLS instance");
            hls.stopLoad();
            hls.detachMedia();
            hls.destroy();
            hls = null;
        }
    };

    const showLoginError = (message = "Invalid credentials or server error") => {
        console.log("[Client] showLoginError:", message);
        if (loginErrorText) loginErrorText.textContent = message;
        loginError?.classList.remove('hidden');
    };

    const hideLoginError = () => { loginError?.classList.add('hidden'); };

    const setGridLoading = (isLoading: boolean, message = "Loading content...") => {
        if (gridLoadingState) {
          gridLoadingState.classList.toggle('hidden', !isLoading);
          if (isLoading) {
            if (contentGrid) contentGrid.innerHTML = '';
            const pElement = gridLoadingState.querySelector('p');
            if (pElement) {
                pElement.innerHTML = message; // Use innerHTML to allow button
                pElement.className = "text-gray-500 mt-2"; // Use className for assigning classes
            }
            noResultsState?.classList.add('hidden');
          }
        }
        // Display error message in grid area if loading finished with error
        if (!isLoading && message.startsWith("Error:") && contentGrid) {
            contentGrid.innerHTML = `<div class="col-span-full text-center py-10 text-red-400"><i class="fas fa-exclamation-circle mr-2"></i> ${message}</div>`;
        }
    };


     const showPlayerLoading = (isLoading: boolean) => {
         if (!videoPlayer) return;
         // Only show loading if the video is trying to play but hasn't started, or is buffering
         const shouldShow = isLoading && !videoPlayer.paused && videoPlayer.error === null && !videoPlayer.seeking && videoPlayer.readyState < 3; // readyState < HAVE_FUTURE_DATA
         playerLoading?.classList.toggle('hidden', !shouldShow);
    };

    const hidePlayerError = () => { playerError?.classList.add('hidden'); };

    const showPlayerError = (message: string) => {
        console.error("[Client] Player Error:", message);
        if (playerErrorText) playerErrorText.textContent = message;
        playerError?.classList.remove('hidden');
        showPlayerLoading(false); // Ensure loading is hidden when error shows
    };

    // --- Main Logic Functions ---

    const loadData = async (type = 'vod') => {
        if (!credentials.serverUrl || !credentials.username || !credentials.password) return;
        console.log(`[Client] loadData: Starting for type "${type}"`);
        setGridLoading(true, `Loading ${type}...`);
        noResultsState?.classList.add('hidden');
        if (contentGrid) contentGrid.innerHTML = '';
        if (categoryContainer) {
             // Ensure "All" button exists and reset others
             const allBtnExists = categoryContainer.querySelector('.category-btn[data-category-id="all"]');
             if (!allBtnExists) {
                 categoryContainer.innerHTML = '<button class="category-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm active" data-category-id="all">All</button>';
                 const newAllBtn = categoryContainer.querySelector('.category-btn[data-category-id="all"]');
                 if(newAllBtn) newAllBtn.addEventListener('click', handleCategoryClick as EventListener); // Add listener to newly created btn
             } else {
                 categoryContainer.querySelectorAll('.category-btn:not([data-category-id="all"])').forEach(btn => btn.remove());
             }
        }

        let categoryAction = ''; let streamAction = '';
        switch (type) {
            case 'live': categoryAction = 'get_live_categories'; streamAction = 'get_live_streams'; break;
            case 'vod': categoryAction = 'get_vod_categories'; streamAction = 'get_vod_streams'; break;
            case 'series': categoryAction = 'get_series_categories'; streamAction = 'get_series'; break;
            default: setGridLoading(false, `Error: Invalid content type "${type}".`); return;
        }

         try {
             console.log(`[Client] loadData: Fetching ${type} categories and streams via proxy...`);
             const [rawCategories, rawStreams] = await Promise.all([
                 fetchViaProxy(categoryAction),
                 fetchViaProxy(streamAction)
             ]);
             console.log(`[Client] loadData: Fetched ${type} data successfully.`);

             const typeKey = type as keyof typeof categories;

             // Process categories
             categories[typeKey] = Array.isArray(rawCategories) ? rawCategories : [];

             // Process streams/series
             if (!Array.isArray(rawStreams)) {
                allContent[typeKey] = [];
             } else {
                 const currentFavorites = favorites[typeKey] || [];
                 const categoryMap = categories[typeKey].reduce((map: any, cat: any) => { map[cat.category_id] = cat.category_name; return map; }, {});
                 allContent[typeKey] = rawStreams.map((item: any) => {
                     const stream_id = item.stream_id || item.series_id;
                     const name = item.name || item.title;
                     const stream_icon = item.stream_icon || item.movie_image || item.cover;
                     const category_id = item.category_id;
                     // Ensure comparison is consistent (string vs string or number vs number)
                     const isFav = currentFavorites.some((favId: string | number) => String(favId) === String(stream_id));
                     let container_extension = item.container_extension;
                     if (type === 'live' && !container_extension) { container_extension = 'm3u8'; } // Default for live
                     return { ...item, stream_id, name: name || 'Unknown Title', stream_icon: stream_icon || PLACEHOLDER_POSTER, category_name: categoryMap[category_id] || 'Uncategorized', isFavorite: isFav, type: type, container_extension: container_extension };
                 });
             }

             renderCategoryButtons();
             setActiveCategoryButton('all'); // Default to 'All'
             renderGrid();
             setGridLoading(false); // Hide loading on success

         } catch (error: any) {
             console.error(`[Client] Error in loadData for ${type}:`, error);
             // Add retry logic reference for the button
             (window as any).retryLoadData = () => loadData(type);
             // FIX: Use class for button styling within innerHTML
             setGridLoading(false, `Error loading ${type}: ${error.message}. <button class='text-blue-400 hover:underline' onclick='window.retryLoadData()'>Retry</button>`);
         } finally {
            // Redundant setGridLoading(false) call removed, handled in try/catch
            console.log(`[Client] loadData: Finished for type "${type}"`);
         }
    };

    const renderCategoryButtons = () => {
         const allBtn = categoryContainer?.querySelector('.category-btn[data-category-id="all"]');
         if (!allBtn || !categoryContainer) return;

         // Clear existing dynamic categories
         categoryContainer.querySelectorAll('.category-btn:not([data-category-id="all"])').forEach(btn => btn.remove());

         const currentCats = categories[currentContentType as keyof typeof categories] || [];
         if (currentCats.length > 0) {
              currentCats.sort((a, b) => (a.category_name || '').localeCompare(b.category_name || ''));
              currentCats.forEach(cat => {
                 if (cat.category_id && cat.category_name) {
                     const btn = document.createElement('button');
                     btn.className = 'category-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm whitespace-nowrap';
                     btn.textContent = cat.category_name;
                     // Use dataset for data attributes
                     btn.dataset.categoryId = String(cat.category_id); // Ensure string
                     // FIX: Add listener with correct type cast
                     btn.addEventListener('click', handleCategoryClick as EventListener);
                     categoryContainer.appendChild(btn);
                 }
              });
         }

         // Ensure listener is attached only once to "All" button (check dataset flag)
         if (allBtn instanceof HTMLElement && !allBtn.dataset.listenerAttached) {
             allBtn.addEventListener('click', handleCategoryClick as EventListener);
             allBtn.dataset.listenerAttached = 'true';
         }
         setActiveCategoryButton(currentFilter?.id || 'all');
     };


    const setActiveCategoryButton = (categoryId: string | null | undefined) => {
         categoryContainer?.querySelectorAll('.category-btn').forEach(b => {
             // FIX: Cast to HTMLElement to access dataset
             const btnEl = b as HTMLElement;
             // Compare dataset value (always string) with potentially null/undefined categoryId
             const isActive = categoryId !== null && categoryId !== undefined && btnEl.dataset.categoryId === String(categoryId);
             btnEl.classList.toggle('active', isActive); // Keep the class for potential CSS rules
             btnEl.classList.toggle('bg-blue-600', isActive); // Tailwind active state
             btnEl.classList.toggle('text-white', isActive);
             btnEl.classList.toggle('bg-gray-700', !isActive); // Tailwind default state
             btnEl.classList.toggle('hover:bg-gray-600', !isActive);
         });
     };

    const filterByCategory = (categoryId: string | number) => {
         console.log(`[Client] Filtering by category: ${categoryId}`);
         currentFilter = { type: 'category', id: String(categoryId) };
         isFavoritesMode = false;
         favoritesBtn?.classList.remove('active', 'text-red-500', 'bg-gray-700');
         setActiveCategoryButton(String(categoryId));
         renderGrid();
     };

    const renderGrid = () => {
         if (!contentGrid) return;
         console.log("[Client] Rendering grid. Filter:", currentFilter, "Favorites Mode:", isFavoritesMode);
         contentGrid.innerHTML = ''; // Clear previous content
         noResultsState?.classList.add('hidden');
         gridLoadingState?.classList.add('hidden');

         let contentToDisplay: any[] = [];
         const typeKey = currentContentType as keyof typeof allContent;
         const sourceContent = allContent[typeKey] || [];

         if (isFavoritesMode) {
             const currentFavoritesList = favorites[typeKey] || [];
             contentToDisplay = sourceContent.filter(item =>
                 currentFavoritesList.some((favId: string | number) => String(favId) === String(item.stream_id || item.series_id))
             );
             console.log(`[Client] Displaying ${contentToDisplay.length} favorite items for ${typeKey}.`);
         } else if (currentFilter.type === 'category') {
             contentToDisplay = (currentFilter.id === 'all' || currentFilter.id == null)
                 ? sourceContent
                 : sourceContent.filter(item => String(item.category_id) == currentFilter.id); // Ensure string comparison
             console.log(`[Client] Displaying ${contentToDisplay.length} items for category ${currentFilter.id}.`);
         } else if (currentFilter.type === 'search' && currentFilter.query) {
             const query = currentFilter.query.toLowerCase();
             contentToDisplay = sourceContent.filter(item =>
                 item.name?.toLowerCase().includes(query) || item.category_name?.toLowerCase().includes(query)
             );
             console.log(`[Client] Displaying ${contentToDisplay.length} items for search query "${currentFilter.query}".`);
         } else {
             contentToDisplay = sourceContent; // Default to all if filter is weird
             console.log(`[Client] Displaying all ${contentToDisplay.length} items (default/unknown filter).`);
         }


         if (contentToDisplay.length === 0) {
             noResultsState?.classList.remove('hidden');
             console.log("[Client] No content found for current filter/view.");
             return;
         }

         // Sort alphabetically by name
         contentToDisplay.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

         // Use DocumentFragment for performance
         const fragment = document.createDocumentFragment();
         contentToDisplay.forEach(item => {
             const card = createContentCard(item);
             fragment.appendChild(card);
         });
         contentGrid.appendChild(fragment);
         console.log("[Client] Grid rendering complete.");
     };

    const createContentCard = (item: any): HTMLDivElement => {
         const card = document.createElement('div');
         card.className = 'content-card bg-gray-800 rounded-lg overflow-hidden shadow-md flex flex-col';
         // FIX: Use class within innerHTML template literals
         const streamId = item.stream_id || item.series_id; // Ensure we have an ID
         card.innerHTML = `
             <img src="${item.stream_icon || PLACEHOLDER_POSTER}" alt="${item.name || 'Poster'}" class="w-full h-auto object-cover flex-shrink-0 bg-gray-700 aspect-[2/3]" onerror="this.onerror=null; this.src='${PLACEHOLDER_POSTER}';" loading="lazy">
             <div class="card-info">
                 <div class="card-title-row">
                     <h4 class="text-sm font-semibold truncate" title="${item.name || ''}">${item.name || 'No Title'}</h4>
                     <button class="favorite-icon-grid ${item.isFavorite ? 'favorited' : ''}" data-stream-id="${streamId}">
                         <i class="${item.isFavorite ? 'fas' : 'far'} fa-heart"></i>
                     </button>
                 </div>
                 ${item.type !== 'live' ? `<p class="text-xs text-gray-400 truncate">${item.category_name || ''}</p>` : ''}
             </div>`;

         // FIX: Add event listener with type casting for event parameter
         card.addEventListener('click', (event: Event) => handleCardClick(event as MouseEvent, item));

         const favoriteButton = card.querySelector('.favorite-icon-grid');
         // FIX: Add event listener with type casting for event parameter
         favoriteButton?.addEventListener('click', (event: Event) => handleFavoriteClick(event as MouseEvent, item));

         return card;
     };


    const openPlayerModal = (stream: any) => {
         if (!stream) return;
         const streamId = stream.stream_id || stream.series_id; // Use consistent ID
         if (!streamId) {
            console.error("[Client] Cannot open player modal: Item is missing stream_id or series_id.", stream);
            return;
         }
         console.log(`[Client] Opening player modal for: ${stream.name} (ID: ${streamId})`);
         currentStream = stream; currentEpisode = null;
         if (modalTitle) modalTitle.textContent = stream.name || 'Loading...';
         if (modalSeriesInfo) { modalSeriesInfo.innerHTML = ''; modalSeriesInfo.classList.add('hidden'); }
         modalVideoContainer?.classList.remove('hidden');
         hidePlayerError(); showPlayerLoading(false); // Reset player state display
         playerModal?.classList.remove('hidden');

         updateModalFavoriteIcon(stream); // Update fav icon state based on passed stream
         if (modalFavoriteBtn) (modalFavoriteBtn as HTMLElement).dataset.streamId = String(streamId); // Set dataset

         if (stream.type === 'series') {
             modalVideoContainer?.classList.add('hidden'); // Hide video initially for series
             modalSeriesInfo?.classList.remove('hidden');
             // FIX: Use class in innerHTML
             if (modalSeriesInfo) modalSeriesInfo.innerHTML = `<div class="flex justify-center items-center h-full p-4"><div class="w-8 h-8 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div><span class="ml-3 text-gray-400">Loading series details...</span></div>`;
             fetchAndDisplaySeriesInfo(stream);
         } else {
             playStreamInternal(stream); // Play directly for VOD/Live
         }
     };

    const closePlayerModal = () => {
         console.log("[Client] Closing player modal");
         playerModal?.classList.add('hidden');
         destroyHlsInstance();
         if(videoPlayer) {
              videoPlayer.pause();
              videoPlayer.removeAttribute('src'); // Remove src to stop loading/playback
              // Attempt to clear buffers if possible (may not be fully reliable)
              try { videoPlayer.load(); } catch (e) { console.warn("Error calling video.load() on close:", e); }
         }
         if (modalTitle) modalTitle.textContent = 'Loading...';
         currentStream = null; currentEpisode = null;
         hidePlayerError(); showPlayerLoading(false);
         modalSeriesInfo?.classList.add('hidden');
         if(modalSeriesInfo) modalSeriesInfo.innerHTML = ''; // Clear series info
         modalVideoContainer?.classList.remove('hidden'); // Ensure video container is visible for next time
     };

    const playStreamInternal = (stream: any, episode: any = null) => {
        // *** This function still uses DIRECT HTTP URLs for video playback ***
        // *** It does NOT use the proxy for the media stream itself ***
        if (!credentials.serverUrl || !credentials.username || !credentials.password) {
             showPlayerError("Cannot play stream: Credentials not available.");
             return;
        }
        if (!stream && !episode) {
            showPlayerError("Cannot play stream: No stream or episode provided.");
            return;
        }

        const itemToPlay = episode || stream;
        const streamType = episode ? 'series' : stream?.type;
        const itemName = episode ? `${currentStream?.name || 'Series'} - S${episode.season} E${episode.episode_num} - ${episode.title || 'Episode'}` : stream?.name || 'Stream';
        const itemId = itemToPlay?.stream_id || itemToPlay?.series_id || itemToPlay?.id; // Get the relevant ID

        if(!itemId) {
            showPlayerError(`Cannot play: Missing ID for item ${itemName}`);
            return;
        }

        console.log(`[Client] playStreamInternal: Preparing to play ${streamType} - ${itemName} (ID: ${itemId})`);
        if(modalTitle) modalTitle.textContent = itemName;

        hidePlayerError(); showPlayerLoading(true); destroyHlsInstance(); // Prepare for new playback

        const extension = itemToPlay.container_extension?.toLowerCase();
        let baseUrl = '';
        let playUsingHls = false;
        let streamUrl = '';

        try {
             const directServerUrl = credentials.serverUrl; // The http://... URL
             const directUsername = credentials.username;
             const directPassword = credentials.password;

             if (!directServerUrl || !directUsername || !directPassword) throw new Error("Missing credentials for direct URL construction.");

             // Construct the DIRECT URL for the player src (HTTP)
            if (streamType === 'live') {
                baseUrl = `${directServerUrl}/live/${directUsername}/${directPassword}/${itemId}.m3u8`;
                playUsingHls = true;
            } else if (streamType === 'vod') {
                baseUrl = `${directServerUrl}/movie/${directUsername}/${directPassword}/${itemId}`;
                playUsingHls = !extension || ['m3u8'].includes(extension); // Assume HLS if extension is m3u8 or missing
                if (!playUsingHls && extension) baseUrl += `.${extension}`; // Add extension for direct play if not HLS
                else if (playUsingHls && extension !== 'm3u8') baseUrl += '.m3u8'; // Append .m3u8 if assuming HLS but no extension given
            } else if (streamType === 'series' && episode) {
                baseUrl = `${directServerUrl}/series/${directUsername}/${directPassword}/${itemId}`; // episode.id should be correct here
                const seriesExtension = episode.container_extension?.toLowerCase() || extension; // Fallback to series extension if episode doesn't have one
                 playUsingHls = !seriesExtension || ['m3u8'].includes(seriesExtension);
                if (!playUsingHls && seriesExtension) baseUrl += `.${seriesExtension}`;
                else if (playUsingHls && seriesExtension !== 'm3u8') baseUrl += '.m3u8';
            } else {
                throw new Error(`Cannot determine playback type or missing episode data for ${streamType}.`);
            }

            streamUrl = baseUrl;
            // Avoid logging password in production environments if possible
            console.log(`[Client] playStreamInternal: Final Stream URL (Direct): ${streamUrl.replace(directPassword, '***')}`);

            if (!videoPlayer) throw new Error("Video player element not found.");

             if (playUsingHls) {
                  if (isHlsSupported()) {
                      initPlayer(); // Will create HLS instance
                      if(hls && videoPlayer) { // Check hls and videoPlayer again
                          console.log("[Client] Attaching HLS.js to video element");
                          hls.attachMedia(videoPlayer);
                          // Use 'once' or 'on' depending if you want this only the first time
                          hls.once(Hls.Events.MEDIA_ATTACHED, () => {
                              console.log(`[Client] Loading HLS source: ${streamUrl.replace(directPassword, '***')}`);
                              hls.loadSource(streamUrl);
                          });
                      } else {
                          throw new Error("HLS Player initialization or video element failed.");
                      }
                  } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl') || videoPlayer.canPlayType('application/x-mpegURL')) {
                      console.log("[Client] Using native HLS playback.");
                      videoPlayer.src = streamUrl;
                      videoPlayer.play().catch(handlePlaybackError);
                      showPlayerLoading(false); // Native HLS might handle loading indicator differently, hide initially
                  } else {
                      throw new Error("HLS playback not supported by this browser.");
                  }
             } else { // Direct playback (non-HLS)
                 console.log("[Client] Using direct video playback (non-HLS).");
                 videoPlayer.src = streamUrl;
                 videoPlayer.play().catch(handlePlaybackError);
                 showPlayerLoading(false); // Hide loading initially for direct play
             }

        } catch (error: any) {
            console.error("[Client] Error setting up player:", error);
            showPlayerError(`Setup Error: ${error.message}`);
            showPlayerLoading(false);
            return; // Stop execution if setup fails
        }

        currentEpisode = episode; // Store the currently playing episode info
        highlightPlayingEpisode(episode?.id);
    };

    const fetchAndDisplaySeriesInfo = async (seriesStream: any) => {
         if (!modalSeriesInfo) return;
         const seriesId = seriesStream.series_id;
         if (!seriesId) {
            console.error("[Client] Cannot fetch series info: Missing series_id.", seriesStream);
            if (modalSeriesInfo) modalSeriesInfo.innerHTML = `<p class="text-center text-red-400 p-4">Error: Could not load series details (Missing ID).</p>`;
            return;
         }
         console.log(`[Client] Fetching series info for: ${seriesStream.name} (ID: ${seriesId})`);
         try {
             const data = await fetchViaProxy('get_series_info', { series_id: seriesId });
             console.log(`[Client] Series info received for: ${seriesStream.name}`);

             if (!data || !data.episodes) throw new Error("Invalid or empty series data received via proxy.");

             modalSeriesInfo.innerHTML = ''; // Clear loading state
             // Check if episodes is an object (expected) or maybe an empty array
             const seasonKeys = typeof data.episodes === 'object' && data.episodes !== null ? Object.keys(data.episodes) : [];
             const seasons = seasonKeys.sort((a, b) => parseInt(a) - parseInt(b));

             if (seasons.length === 0) {
                 // FIX: Use class in innerHTML
                 modalSeriesInfo.innerHTML = '<p class="text-center text-gray-400 p-4">No episodes found for this series.</p>';
                 return;
             }

             // Create UI structure (Container, Selector, List)
             const uiContainer = document.createElement('div'); uiContainer.className = 'flex flex-col md:flex-row gap-0 h-full';
             const seasonSelectorContainer = document.createElement('div'); seasonSelectorContainer.className = 'season-selector-container md:w-1/4 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-700';
             const seasonLabel = document.createElement('label'); seasonLabel.htmlFor = 'season-select'; seasonLabel.className = 'block text-sm font-medium text-gray-300 mb-1 px-3 pt-3'; seasonLabel.textContent = 'Select Season:';
             const seasonSelect = document.createElement('select'); seasonSelect.id = 'season-select'; seasonSelect.className = 'season-selector w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500 mx-3 mb-3';
             seasons.forEach(seasonNum => { const option = document.createElement('option'); option.value = seasonNum; option.textContent = `Season ${seasonNum}`; seasonSelect.appendChild(option); });
             seasonSelectorContainer.appendChild(seasonLabel); seasonSelectorContainer.appendChild(seasonSelect);
             const episodeListContainer = document.createElement('div'); episodeListContainer.id = 'episode-list-container'; episodeListContainer.className = 'episode-list flex-grow overflow-y-auto p-2';
             uiContainer.appendChild(seasonSelectorContainer); uiContainer.appendChild(episodeListContainer);
             modalSeriesInfo.appendChild(uiContainer);

             // Function to display episodes
             const displayEpisodes = (seasonNum: string) => {
                 episodeListContainer.innerHTML = '';
                 const episodes = data.episodes[seasonNum] || [];
                 if (episodes.length === 0) {
                     // FIX: Use class in innerHTML
                     episodeListContainer.innerHTML = '<p class="text-gray-500 p-4">No episodes listed for this season.</p>';
                     return;
                 }
                 // Sort episodes numerically
                 episodes.sort((a: any, b: any) => parseInt(a.episode_num) - parseInt(b.episode_num));

                 episodes.forEach((ep: any) => {
                     if (!ep.id) { console.warn("Episode missing ID:", ep); return; }
                     // Ensure necessary properties exist
                     ep.season = ep.season || parseInt(seasonNum);
                     ep.container_extension = ep.container_extension || ep.info?.movie_format || seriesStream.container_extension || 'm3u8'; // Default to m3u8

                     const epElement = document.createElement('div');
                     epElement.className = 'episode-item';
                     epElement.dataset.episodeId = String(ep.id); // Ensure string
                     // FIX: Use class in innerHTML template literals
                     epElement.innerHTML = `
                         <span class="font-semibold">${ep.episode_num}. ${ep.title || 'Untitled Episode'}</span>
                         ${ep.air_date ? `<span class="text-xs text-gray-400 ml-2">(${ep.air_date})</span>` : ''}
                         ${ep.info?.duration ? `<span class="text-xs text-gray-500 float-right">${ep.info.duration}</span>` : ''}
                     `;
                     // Add click listener to play episode
                     epElement.addEventListener('click', () => handleEpisodeClick(ep));
                     episodeListContainer.appendChild(epElement);
                 });
                 // Highlight if the currently playing episode is in this season
                 if (currentEpisode && String(currentEpisode.season) === seasonNum) {
                     highlightPlayingEpisode(currentEpisode.id);
                 }
             };

             // Attach change listener to season select dropdown
             seasonSelect.addEventListener('change', (e) => {
                 const target = e.target as HTMLSelectElement;
                 displayEpisodes(target.value);
             });

             // Initial display for the first season
             displayEpisodes(seasons[0]);
             seasonSelect.value = seasons[0]; // Set select value to the first season

         } catch (error: any) {
             console.error("[Client] Error fetching/displaying series info:", error);
             // FIX: Use class in innerHTML
             if (modalSeriesInfo) modalSeriesInfo.innerHTML = `<p class="text-center text-red-400 p-4">Error loading series details: ${error.message}</p>`;
         }
    };

    const highlightPlayingEpisode = (episodeId: string | number | undefined) => {
        if (episodeId === undefined || !modalSeriesInfo) return;
        const episodeIdStr = String(episodeId);
        modalSeriesInfo.querySelectorAll('.episode-item').forEach(item => {
             const el = item as HTMLElement;
             // Check dataset value for match
             el.classList.toggle('playing', el.dataset.episodeId === episodeIdStr);
        });
    };

    const updateModalFavoriteIcon = (stream: any) => {
        if (!stream || !modalFavoriteBtn) return;
        const streamId = String(stream.stream_id || stream.series_id); // Ensure string ID
        const contentType = stream.type as keyof typeof favorites;
        // Check against the central favorites state
        const isFav = favorites[contentType]?.includes(streamId);

        // Update stream object's state if necessary (optional, but keeps it consistent)
        // stream.isFavorite = isFav;

        const modalHeartIcon = modalFavoriteBtn.querySelector('i');
        if (modalHeartIcon) {
            modalFavoriteBtn.classList.toggle('favorited', !!isFav); // Use boolean coercion
            modalHeartIcon.classList.toggle('fas', !!isFav); // Solid heart
            modalHeartIcon.classList.toggle('far', !isFav); // Outline heart
        }
    };

    const toggleFavorite = (item: any) => {
        if (!item || !(item.stream_id || item.series_id)) {
            console.warn("[Client] toggleFavorite called with invalid item:", item);
            return;
        }
        const streamId = String(item.stream_id || item.series_id); // Consistent string ID
        const contentType = item.type as keyof typeof favorites;

        console.log(`[Client] Toggling favorite for: ${item.name} (ID: ${streamId}, Type: ${contentType})`);

        // Ensure the favorites array for the type exists
        if (!favorites[contentType]) {
            favorites[contentType] = [];
        }

        let favoritesList: (string | number)[] = favorites[contentType];
        const isCurrentlyFav = favoritesList.some(id => String(id) === streamId);
        let changed = false;

        if (isCurrentlyFav) {
            // Remove from favorites
            const initialLength = favorites[contentType].length;
            favorites[contentType] = favoritesList.filter(id => String(id) !== streamId);
            if (favorites[contentType].length < initialLength) {
                item.isFavorite = false; // Update item state
                changed = true;
                console.log(`[Client] Removed ${streamId} from ${contentType} favorites.`);
            }
        } else {
            // Add to favorites
            favorites[contentType] = [...favoritesList, streamId]; // Add as string
            item.isFavorite = true; // Update item state
            changed = true;
            console.log(`[Client] Added ${streamId} to ${contentType} favorites.`);
        }

        if (!changed) {
            console.log("[Client] Favorite state did not change.");
            return; // Avoid unnecessary updates if state didn't actually change
        }

        console.log(`[Client] Favorite status for ${streamId} is now: ${item.isFavorite}`);

        // Update icon in the grid immediately
        const cardFavoriteButton = contentGrid?.querySelector(`.favorite-icon-grid[data-stream-id="${streamId}"]`);
        if (cardFavoriteButton) {
            const icon = cardFavoriteButton.querySelector('i');
            cardFavoriteButton.classList.toggle('favorited', item.isFavorite);
            if (icon) {
                icon.classList.toggle('fas', item.isFavorite);
                icon.classList.toggle('far', !item.isFavorite);
            }
        } else {
             console.warn(`[Client] Could not find favorite button in grid for stream ID: ${streamId}`);
        }

        // Update localStorage
        try {
            localStorage.setItem(`iptvFavorites_xtreme_${contentType}`, JSON.stringify(favorites[contentType]));
            console.log(`[Client] Updated localStorage for ${contentType} favorites.`);
        } catch (e) {
            console.error("[Client] Failed to save favorites to localStorage:", e);
        }

        // Update modal icon if this item is currently displayed in the modal
        const isModalVisible = playerModal && !playerModal.classList.contains('hidden');
        const isCurrentStream = currentStream && String(currentStream.stream_id || currentStream.series_id) === streamId;
        if (isModalVisible && isCurrentStream) {
            updateModalFavoriteIcon(item); // Pass the updated item
        }

        // Re-render grid ONLY if currently in favorites view and the item's status changed
        if (isFavoritesMode && changed) {
            console.log("[Client] Re-rendering grid due to favorite toggle in favorites view.");
            renderGrid();
        }
    };


    const toggleModalFavorite = () => {
        if (!currentStream) {
            console.warn("[Client] Cannot toggle modal favorite: currentStream is null.");
            return;
        }
        console.log("[Client] Toggling favorite via modal button for:", currentStream.name);
        // Find the item in the main `allContent` list to ensure we toggle the canonical object
        const contentType = currentStream.type as keyof typeof allContent;
        const streamId = String(currentStream.stream_id || currentStream.series_id);
        const itemInContentList = allContent[contentType]?.find(content => String(content.stream_id || content.series_id) === streamId);

        if (itemInContentList) {
            toggleFavorite(itemInContentList); // Toggle the item from the main list
        } else {
            // Fallback: toggle the currentStream object directly, but this might be stale
            console.warn("[Client] Could not find stream in allContent list, toggling currentStream object directly.");
            toggleFavorite(currentStream);
        }
    };


    const switchSection = async (type?: string) => {
        if (!type || !['live', 'vod', 'series'].includes(type)) {
             console.warn(`[Client] Invalid section type provided: ${type}`);
             return;
        }
        console.log(`[Client] Switching section to: ${type}`);

        // Reset search/favorites state when switching sections
        if(searchInput) searchInput.value = '';
        isFavoritesMode = false; // Always turn off favorites view when switching sections
        favoritesBtn?.classList.remove('active', 'text-red-500', 'bg-gray-700');
        currentFilter = { type: 'category', id: 'all' }; // Reset filter to 'all' category

        currentContentType = type;
        setActiveSectionButton(type);

        // Decide whether to load or just render
        const typeKey = type as keyof typeof allContent;
        if (!allContent[typeKey] || allContent[typeKey].length === 0) {
            console.log(`[Client] Data not loaded for ${type}, initiating load.`);
            await loadData(type); // loadData handles loading state
        } else {
            console.log(`[Client] Data already loaded for ${type}, rendering categories and grid.`);
            setGridLoading(false); // Ensure loading indicator is off
            renderCategoryButtons(); // Re-render categories for the new type
            setActiveCategoryButton('all'); // Ensure 'All' is selected
            renderGrid(); // Render the existing data
        }
    };

     const setActiveSectionButton = (type?: string) => {
        sectionBtnsNodeList?.forEach(btnNode => {
            if (btnNode instanceof HTMLElement) { // Type guard
                 const btnEl = btnNode as HTMLElement;
                 const isActive = btnEl.dataset.type === type;
                 btnEl.classList.toggle('active', isActive); // Optional 'active' class
                 btnEl.classList.toggle('bg-blue-600', isActive); // Active style
                 btnEl.classList.toggle('text-white', isActive); // Active style
                 btnEl.classList.toggle('bg-gray-700', !isActive); // Default style
                 btnEl.classList.toggle('hover:bg-blue-700', !isActive); // Default hover
            }
        });
    };

    const toggleFavoritesView = () => {
         isFavoritesMode = !isFavoritesMode;
         console.log(`[Client] Toggling favorites view. Now: ${isFavoritesMode}`);
         favoritesBtn?.classList.toggle('active', isFavoritesMode);
         favoritesBtn?.classList.toggle('text-red-500', isFavoritesMode); // Use Tailwind for active state
         favoritesBtn?.classList.toggle('bg-gray-700', isFavoritesMode); // Optional background change

         if (isFavoritesMode) {
             setActiveCategoryButton(null); // Deactivate category buttons visually
             currentFilter = { type: 'favorites' }; // Indicate favorites filtering
             console.log(`[Client] Set filter to favorites for type: ${currentContentType}`);
         } else {
             // Revert to 'all' category filter when turning favorites off
             currentFilter = { type: 'category', id: 'all'};
             setActiveCategoryButton('all');
             console.log(`[Client] Reverted filter to 'all' category for type: ${currentContentType}`);
         }
         renderGrid(); // Re-render the grid with the new mode
     };


    const handleSearch = () => {
         const query = searchInput?.value?.trim().toLowerCase() ?? '';
         console.log(`[Client] Search triggered. Query: "${query}"`);

         // Determine the previous filter type before potentially changing it
         const previousFilterType = currentFilter.type;

         if (query.length >= 2) {
             // Activate search filter
             if (currentFilter.type !== 'search' || currentFilter.query !== query) {
                 console.log(`[Client] Applying search filter: "${query}"`);
                 currentFilter = { type: 'search', query: query };
                 isFavoritesMode = false; // Turn off favorites mode when searching
                 favoritesBtn?.classList.remove('active','text-red-500', 'bg-gray-700');
                 setActiveCategoryButton(null); // Deactivate category buttons visually
                 renderGrid();
             }
         } else if (query.length === 0 && previousFilterType === 'search') {
             // Search cleared, revert to 'all' category view
             console.log("[Client] Search cleared, reverting to 'All' category view.");
             filterByCategory('all'); // This sets filter, updates buttons, and renders grid
         } else {
             // Query is < 2 chars, or hasn't changed enough, or wasn't a search before.
             // Do nothing, or potentially clear results if query becomes < 2 after being >= 2.
             // Current behavior: Only triggers render on >= 2 or clear.
              if (contentGrid && query.length > 0 && query.length < 2 && previousFilterType === 'search') {
                // Optional: Show a "type more" message or clear grid if desired
                // contentGrid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Type at least 2 characters to search.</div>`;
                // noResultsState?.classList.add('hidden');
                // gridLoadingState?.classList.add('hidden');
              }
         }
     };

     const logout = () => {
        console.log("[Client] Logging out.");
        closePlayerModal(); // Ensure player is closed and cleaned up
        destroyHlsInstance(); // Clean up HLS if any

        // Clear sensitive data
        localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
        localStorage.removeItem('iptvFavorites_xtreme_live');
        localStorage.removeItem('iptvFavorites_xtreme_vod');
        localStorage.removeItem('iptvFavorites_xtreme_series');
        credentials = {}; // Clear credentials from memory

        // Reset application state
        allContent = { live: [], vod: [], series: [] };
        categories = { live: [], vod: [], series: [] };
        favorites = { live: [], vod: [], series: [] };
        currentStream = null;
        currentEpisode = null;
        currentContentType = 'vod'; // Reset to default section
        currentFilter = { type: 'category', id: 'all' }; // Reset filter
        isFavoritesMode = false;

        // Reset UI elements to initial state
        if (contentGrid) contentGrid.innerHTML = ''; // Clear content grid
        if (categoryContainer) { // Reset categories
             const allBtn = categoryContainer.querySelector('.category-btn[data-category-id="all"]');
             if (allBtn) {
                categoryContainer.innerHTML = ''; // Clear all buttons first
                categoryContainer.appendChild(allBtn.cloneNode(true)); // Add back only the 'All' button (clone to avoid issues)
                // Re-attach listener to the new 'All' button if needed (though likely handled on next init)
             } else {
                // If even 'All' button wasn't there, reset completely
                 categoryContainer.innerHTML = '<button class="category-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm active" data-category-id="all">All</button>';
             }
        }
        favoritesBtn?.classList.remove('active','text-red-500', 'bg-gray-700');
        if(searchInput) searchInput.value = '';
        if (serverInfo) { serverInfo.textContent = 'Not connected'; serverInfo.title = 'Not Connected'; }

        // Reset login form fields
        const protocolSelect = getElementById<HTMLSelectElement>('protocol');
        const serverInput = getElementById<HTMLInputElement>('server');
        const usernameInput = getElementById<HTMLInputElement>('username');
        const passwordInput = getElementById<HTMLInputElement>('password');
        if(protocolSelect) protocolSelect.value = 'http://';
        if(serverInput) serverInput.value = '';
        if(usernameInput) usernameInput.value = '';
        if(passwordInput) passwordInput.value = '';
        if(rememberMeCheckbox) rememberMeCheckbox.checked = false;

        // Hide the main app and show the login screen
        app?.classList.add('hidden');
        loginScreen?.classList.remove('hidden');
        getElementById<HTMLInputElement>('server')?.focus(); // Focus server field
        console.log("[Client] Logout complete. Login screen displayed.");
    };


    const proceedWithLogin = async (savedCreds: any = null) => {
        console.log("[Client] proceedWithLogin called.", savedCreds ? "Using saved credentials." : "Using form credentials.");
        hideLoginError();
        const loginButton = loginForm?.querySelector('button[type="submit"]');
        // FIX: Cast loginButton to HTMLButtonElement to access 'disabled'
        const loginButtonElement = loginButton as HTMLButtonElement | null;

        if(loginButtonElement) {
             loginButtonElement.disabled = true;
             // FIX: Use class inside innerHTML string literal
             loginButtonElement.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Logging in...`;
        }

        let tempCredentials: { serverUrl?: string, username?: string, password?: string, remember?: boolean } = {};

        try {
             if (savedCreds) {
                 // Using saved credentials from localStorage
                 if(!savedCreds.serverUrl || !savedCreds.username || typeof savedCreds.password === 'undefined') {
                     throw new Error("Saved credentials format is invalid.");
                 }
                 tempCredentials = savedCreds;
                 tempCredentials.remember = true; // Assume remember if loaded from storage
                 console.log("[Client] Using saved credentials:", { serverUrl: tempCredentials.serverUrl, username: tempCredentials.username });

                 // Pre-fill form fields from saved credentials
                 const protocolSelect = getElementById<HTMLSelectElement>('protocol');
                 const serverInput = getElementById<HTMLInputElement>('server');
                 const usernameInput = getElementById<HTMLInputElement>('username');
                 const passwordInput = getElementById<HTMLInputElement>('password');
                 if(tempCredentials.serverUrl){
                    // Basic parsing, assumes http:// or https:// prefix
                    const urlParts = tempCredentials.serverUrl.match(/^(https?):\/\/(.*)$/);
                    if (urlParts && urlParts.length === 3) {
                        if (protocolSelect) protocolSelect.value = urlParts[1] + '://';
                        if (serverInput) serverInput.value = urlParts[2]; // Host + port (if present)
                    } else {
                         // Fallback if no protocol found (shouldn't happen with validation)
                         if (protocolSelect) protocolSelect.value = 'http://';
                         if (serverInput) serverInput.value = tempCredentials.serverUrl;
                    }
                 }
                 if (usernameInput) usernameInput.value = tempCredentials.username ?? '';
                 if (passwordInput) passwordInput.value = tempCredentials.password ?? '';
                 if (rememberMeCheckbox) rememberMeCheckbox.checked = true;

             } else {
                 // Using form credentials
                  const protocolSelect = getElementById<HTMLSelectElement>('protocol');
                  const serverInput = getElementById<HTMLInputElement>('server');
                  const usernameInput = getElementById<HTMLInputElement>('username');
                  const passwordInput = getElementById<HTMLInputElement>('password');

                  if (!protocolSelect || !serverInput || !usernameInput || !passwordInput) {
                      throw new Error("Could not find all login form input elements.");
                  }
                  console.log("[Client] Reading credentials from form.");

                  const protocol = protocolSelect.value;
                  const server = serverInput.value.trim();
                  const username = usernameInput.value.trim();
                  const password = passwordInput.value; // Keep password as entered
                  const remember = rememberMeCheckbox?.checked ?? false;

                 if (!server || !username || password.length === 0) { // Check password length explicitly
                    throw new Error("Please fill in all fields (Server, Username, Password).");
                 }
                 // Basic validation to prevent common errors
                 if (server.includes('://')) { throw new Error("Server field should not contain http:// or https://. Select protocol from dropdown."); }

                 // ---------- PORT CHECK REMOVED ----------
                 // if (!server.includes(':')) { throw new Error("Server field must include the port number (e.g., server.com:8080)."); }
                 // ----------------------------------------

                 tempCredentials = { serverUrl: protocol + server, username, password, remember };
                 console.log("[Client] Using form credentials:", { serverUrl: tempCredentials.serverUrl, username: tempCredentials.username });
             }

            // Set credentials *before* calling proxy for validation
            // This makes them available to fetchViaProxy
            credentials = { ...tempCredentials }; // Create a copy

            console.log("[Client] Attempting to validate credentials via proxy using:", {serverUrl: credentials.serverUrl, username: credentials.username});
            // Use a simple action like get_user_info for validation
            const validationData = await fetchViaProxy('get_user_info');
            console.log("[Client] Validation response received via proxy:", validationData);

            // Check authentication status from the response
            // Adjust this check based on the actual structure of your Xtreme Codes panel response
            const isAuthenticated = validationData?.user_info?.auth === 1;

            if (isAuthenticated) {
                 console.log("[Client] Authentication successful!");
                 // Credentials are valid, keep them (already set in `credentials`)

                 // Handle 'Remember Me'
                 if (credentials.remember) {
                     // Store credentials (excluding 'remember' flag itself)
                     localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ serverUrl: credentials.serverUrl, username: credentials.username, password: credentials.password }));
                     console.log("[Client] Saved credentials to localStorage.");
                 } else {
                     localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
                     console.log("[Client] Cleared credentials from localStorage (Remember Me unchecked).");
                 }

                // Update UI: Hide login, show app
                console.log("[Client] Updating UI: Hiding login, showing app...");
                loginScreen?.classList.add('hidden');
                app?.classList.remove('hidden');
                if (serverInfo && credentials.serverUrl && credentials.username) {
                    const displayUrl = credentials.serverUrl.replace(/^https?:\/\//, ''); // Remove protocol for display
                    const displayText = `${credentials.username}@${displayUrl}`;
                    serverInfo.textContent = displayText;
                    serverInfo.title = displayText; // Set title attribute for full view on hover
                }

                // Reset app state and load initial data
                console.log("[Client] Resetting state and loading initial data...");
                allContent = { live: [], vod: [], series: [] };
                categories = { live: [], vod: [], series: [] };
                // Reload favorites from storage AFTER successful login
                favorites = {
                    live: JSON.parse(localStorage.getItem('iptvFavorites_xtreme_live') || '[]'),
                    vod: JSON.parse(localStorage.getItem('iptvFavorites_xtreme_vod') || '[]'),
                    series: JSON.parse(localStorage.getItem('iptvFavorites_xtreme_series') || '[]')
                 };
                console.log("[Client] Loaded favorites post-login:", favorites);
                currentContentType = 'vod'; // Default section
                currentFilter = { type: 'category', id: 'all' }; // Default filter
                isFavoritesMode = false;
                favoritesBtn?.classList.remove('active','text-red-500', 'bg-gray-700'); // Reset favorites button style
                setActiveSectionButton(currentContentType); // Set active section button
                await loadData(currentContentType); // Load initial data for the default section
                console.log("[Client] Login process complete and initial data loaded.");

            } else {
                 // Authentication failed
                 console.warn("[Client] Authentication failed via proxy.", validationData);
                 credentials = {}; // Clear the potentially invalid credentials
                 // If auto-login with saved creds failed, remove them
                 if (savedCreds) {
                    localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
                    console.log("[Client] Removed invalid saved credentials from localStorage.");
                 }
                 // Provide a user-friendly error message
                 const failureReason = validationData?.user_info?.message || validationData?.message || "Authentication failed. Please check your Server URL, Username, and Password.";
                 throw new Error(failureReason);
            }
        } catch (error: any) {
            console.error("[Client] Error during login process:", error);
            credentials = {}; // Clear credentials on any error during login
            showLoginError(`Login Failed: ${error.message}`);
            // If auto-login failed, ensure the login screen is visible
            if (savedCreds) {
                showLoginScreen(); // Re-show login if auto-login fails
            }
        } finally {
            // Re-enable login button regardless of success or failure
            if(loginButtonElement){
                loginButtonElement.disabled = false;
                // FIX: Use class inside innerHTML string literal
                loginButtonElement.innerHTML = `<i class="fas fa-sign-in-alt mr-2"></i> Login`;
            }
        }
    };

    // --- Event Handlers ---
    // Ensure handlers have correct parameter types

    const handleManualLoginSubmit = (event: SubmitEvent) => { // Use SubmitEvent for form submission
        console.log("[Client] handleManualLoginSubmit triggered!");
        event.preventDefault(); // Prevent default form submission
        console.log("[Client] Calling proceedWithLogin from submit handler...");
        // Call login logic, passing null to indicate form usage
        proceedWithLogin(null).catch(err => {
            // Error display is handled within proceedWithLogin, just log here if needed
            console.error("[Client] proceedWithLogin promise rejected (error likely shown already):", err);
        });
    };

    const handleModalClose = () => closePlayerModal();

    // FIX: Correct event type for modal overlay click
    const handleModalOverlayClick = (event: MouseEvent) => {
         // Close only if the click is directly on the modal backdrop, not the content inside
         if (event.target === playerModal) {
             closePlayerModal();
         }
    };

    // FIX: Correct event type for category click
    const handleCategoryClick = (event: MouseEvent) => {
        // Ensure the clicked element is an HTMLElement to access dataset
        const targetElement = event.currentTarget as HTMLElement;
        const categoryId = targetElement?.dataset.categoryId;
        if (categoryId !== undefined) { // Check if dataset property exists
            filterByCategory(categoryId);
        } else {
            console.warn("[Client] Category button clicked, but categoryId dataset is missing.", targetElement);
        }
    };

    // FIX: Correct event type for section click
    const handleSectionClick = (event: MouseEvent) => {
         // Ensure the clicked element is an HTMLElement to access dataset
         const targetElement = event.currentTarget as HTMLElement;
         const type = targetElement?.dataset.type;
         if(type) {
             switchSection(type);
         } else {
             console.warn("[Client] Section button clicked, but type dataset is missing.", targetElement);
         }
    };

    // FIX: Correct event type for card click (already MouseEvent, fine)
    const handleCardClick = (event: MouseEvent, item: any) => {
         // Prevent modal opening if the click was on the favorite icon inside the card
         const clickedElement = event.target as HTMLElement;
         if (clickedElement.closest('.favorite-icon-grid')) {
             // Click was on or inside the favorite button, handled by handleFavoriteClick
             return;
         }
         // Otherwise, open the player modal for the item
         openPlayerModal(item);
     };

    // FIX: Correct event type for favorite icon click (already MouseEvent, fine)
     const handleFavoriteClick = (event: MouseEvent, item: any) => {
         event.stopPropagation(); // Prevent the card click event from firing
         toggleFavorite(item);
     };

     const handleEpisodeClick = (episode: any) => {
         console.log("[Client] Episode clicked:", episode?.title, `(ID: ${episode?.id})`);
         modalVideoContainer?.classList.remove('hidden'); // Ensure video player area is visible
         playStreamInternal(currentStream, episode); // Play the selected episode
     };

    // HLS Error Handler - Ensure Hls types are used if available, otherwise 'any'
     const handleHlsError = (event: any, data: any) => {
         if (!data || !Hls) return; // Check if Hls is loaded and data exists
         console.error("HLS Error Event:", "Type:", data.type, "Details:", data.details, "Fatal:", data.fatal);

         // Basic error reporting for fatal errors
         if (data.fatal) {
            let errorDetails = 'Unknown HLS error';
            if (data.details) {
                errorDetails = data.details;
                // Optional: Provide more user-friendly messages for common errors
                 switch (data.details) {
                     case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
                     case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
                         errorDetails = "Could not load stream data (manifest error). Check connection or stream source.";
                         break;
                     case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
                     case Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT:
                         errorDetails = "Network error loading video segment. Check connection.";
                         break;
                    // Add more cases as needed
                 }
            } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                errorDetails = "Network error occurred during playback.";
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                errorDetails = "Media playback error occurred.";
            }

            showPlayerError(`Playback Error: ${errorDetails}`);
            showPlayerLoading(false); // Hide loading on fatal error

             // Optional: Attempt recovery for certain non-fatal errors or specific fatal ones
             // switch (data.details) {
             //    case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
             //        console.warn("HLS Buffer stalled, trying to recover...");
             //        hls.startLoad(); // Try restarting loading
             //        break;
             //    case Hls.ErrorDetails.FRAG_LOAD_ERROR:
             //        console.warn("HLS Fragment load error, recovery attempt might be automatic.");
             //        break;
             //}
         } else {
             // Log non-fatal errors for debugging if needed
             // console.warn("Non-fatal HLS Error:", data.details);
         }
     };

     // HTML Video Element Error Handler
     // FIX: Correct event type and access MediaError constants correctly
     const handleVideoElementError = (event: Event) => {
        const video = event.target as HTMLVideoElement;
        let errorMsg = "An unknown video playback error occurred.";
        if (video.error) {
            console.error("Video Element Error - Code:", video.error.code, "Message:", video.error.message);
            // FIX: Access constants via MediaError constructor
            switch (video.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMsg = 'Video playback was aborted.';
                    // Often happens on source change, could potentially ignore or log differently
                    console.warn("Video playback aborted, likely intentional.");
                    // Don't show error to user for aborts?
                    hidePlayerError(); // Hide error message for aborts
                    return; // Exit handler for aborts
                case MediaError.MEDIA_ERR_NETWORK: // Correct constant name
                    errorMsg = 'A network error caused the video download to fail.';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorMsg = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMsg = 'The video could not be loaded, either because the server or network failed or because the format is not supported.';
                    break;
                default:
                    errorMsg = `An unknown error occurred (Code ${video.error.code}).`;
                    break;
            }
        } else {
             console.error("Video Element Error: Unknown (no error object available)");
        }
        showPlayerError(errorMsg); // Display the error
        showPlayerLoading(false); // Ensure loading indicator is hidden
    };


    // Handle errors during video.play() promise
    const handlePlaybackError = (error: any) => {
        // Ignore AbortError which occurs when changing source rapidly
        if (error.name !== 'AbortError') {
            console.error("Playback Initiation Error:", error.name, error.message, error);
            showPlayerError(`Could not start playback: ${error.message}.`);
            showPlayerLoading(false);
        } else {
             console.log("[Client] Playback aborted (likely intentional source change or user action).");
             // Optionally hide loading/error if it was shown briefly
             // hidePlayerError();
             // showPlayerLoading(false);
        }
    };

    // Video state handlers
    const handleVideoWaiting = () => {
        console.log("[Client] Video Waiting (Buffering)...");
        // Only show loading if not paused and no error exists
        if (videoPlayer && !videoPlayer.paused && !videoPlayer.error) {
            showPlayerLoading(true);
        }
    };
    const handleVideoPlaying = () => {
        console.log("[Client] Video Playing.");
        showPlayerLoading(false);
        hidePlayerError(); // Hide error once playback starts/resumes
    };
    const handleVideoCanPlay = () => {
        console.log("[Client] Video Can Play.");
        // Hide loading indicator when the browser thinks it can play through
        // This might hide loading too early sometimes if buffering is needed later
         showPlayerLoading(false);
    };
    const handleVideoEnded = () => {
        console.log("[Client] Video ended.");
        showPlayerLoading(false);
        // Optionally close modal, or setup next episode for series?
        // For now, just stops showing loading indicator.
        // closePlayerModal(); // Uncomment to close modal on end
    };

    // --- Initialization and Cleanup ---

    const initializeApp = () => {
         console.log("[Client] Initializing App...");

         // Load favorites from storage first
         try {
             favorites = {
                 live: JSON.parse(localStorage.getItem('iptvFavorites_xtreme_live') || '[]'),
                 vod: JSON.parse(localStorage.getItem('iptvFavorites_xtreme_vod') || '[]'),
                 series: JSON.parse(localStorage.getItem('iptvFavorites_xtreme_series') || '[]')
             };
             console.log("[Client] Loaded favorites from localStorage:", favorites);
         } catch (e) {
             console.error("[Client] Error parsing favorites from localStorage:", e);
             favorites = { live: [], vod: [], series: [] }; // Reset on error
         }


         // Attach Event Listeners using defined handlers
         // Ensure elements exist before adding listeners
         if (loginForm) {
            console.log("[Client] Adding submit listener to login form.");
            // Use SubmitEvent type for the event
            loginForm.addEventListener('submit', handleManualLoginSubmit as EventListener);
         } else {
            console.error("[Client] CRITICAL: Could not find login form element!");
         }

         modalCloseBtn?.addEventListener('click', handleModalClose);
         // FIX: Add listener with correct type
         playerModal?.addEventListener('click', handleModalOverlayClick as EventListener);
         modalFavoriteBtn?.addEventListener('click', toggleModalFavorite);

         sectionBtnsNodeList?.forEach(btn => {
             // FIX: Cast btn to HTMLElement before adding listener
             if (btn instanceof HTMLElement) {
                 btn.addEventListener('click', handleSectionClick as EventListener);
             }
         });
         favoritesBtn?.addEventListener('click', toggleFavoritesView);
         logoutBtn?.addEventListener('click', logout);
         // FIX: Add listener with correct type for input event
         searchInput?.addEventListener('input', handleSearch); // 'input' event is usually better than 'change' for search-as-you-type

         // Category button listeners are attached dynamically in renderCategoryButtons

         // Video Player Listeners (ensure videoPlayer exists)
         if (videoPlayer) {
             videoPlayer.addEventListener('error', handleVideoElementError);
             videoPlayer.addEventListener('waiting', handleVideoWaiting);
             videoPlayer.addEventListener('playing', handleVideoPlaying);
             videoPlayer.addEventListener('canplay', handleVideoCanPlay);
             videoPlayer.addEventListener('ended', handleVideoEnded);
             // Optional: Add more listeners as needed (e.g., 'pause', 'seeked', 'timeupdate')
             // videoPlayer.addEventListener('pause', () => console.log("Video paused"));
             // videoPlayer.addEventListener('play', () => console.log("Video play triggered")); // Useful for debugging play() calls
         } else {
             console.error("[Client] CRITICAL: Could not find video player element!");
         }

         // Check for saved credentials and attempt auto-login
         const savedCredsString = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
         if (savedCredsString) {
            console.log("[Client] Found saved credentials in localStorage.");
             try {
                 const savedCreds = JSON.parse(savedCredsString);
                 // Basic validation of saved credentials structure
                 if (savedCreds.serverUrl && savedCreds.username && typeof savedCreds.password !== 'undefined') {
                     if(rememberMeCheckbox) rememberMeCheckbox.checked = true; // Check the box if loading saved creds
                     console.log("[Client] Attempting auto-login with saved credentials...");
                     // Attempt login using saved credentials
                     proceedWithLogin(savedCreds).catch(err => {
                         console.error("[Client] Error during auto-login attempt:", err);
                         // If auto-login fails, explicitly show the login screen
                         showLoginScreen();
                     });
                 } else {
                     console.warn("[Client] Saved credentials format invalid. Clearing storage and showing login.");
                     localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
                     showLoginScreen();
                 }
             } catch (e) {
                 console.error("[Client] Error parsing saved credentials from localStorage. Clearing storage.", e);
                 localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
                 showLoginScreen(); // Show login screen if parsing fails
             }
         } else {
             // No saved credentials, show the login screen
             console.log("[Client] No saved credentials found. Showing login screen.");
             showLoginScreen();
         }
    };

    const showLoginScreen = () => {
        console.log("[Client] Showing login screen.");
        app?.classList.add('hidden'); // Hide main app content
        loginScreen?.classList.remove('hidden'); // Show login form container
        // Attempt to focus the server input field for better UX
        getElementById<HTMLInputElement>('server')?.focus();
    };

    // Run Initialization logic when the component mounts
    initializeApp();

    // --- Effect Cleanup ---
    // This function runs when the component unmounts
    return () => {
      console.log("[Client] Cleaning up Home Page (IPTV) component effect."); // Updated log message
      destroyHlsInstance(); // Clean up HLS instance if active

      // Remove listeners using the *same* handler function references
      if (loginForm) loginForm.removeEventListener('submit', handleManualLoginSubmit as EventListener);
      modalCloseBtn?.removeEventListener('click', handleModalClose);
      playerModal?.removeEventListener('click', handleModalOverlayClick as EventListener);
      modalFavoriteBtn?.removeEventListener('click', toggleModalFavorite);
      sectionBtnsNodeList?.forEach(btn => {
          if (btn instanceof HTMLElement) { // FIX: Cast needed
              btn.removeEventListener('click', handleSectionClick as EventListener);
          }
      });
      favoritesBtn?.removeEventListener('click', toggleFavoritesView);
      logoutBtn?.removeEventListener('click', logout);
      searchInput?.removeEventListener('input', handleSearch);

      // Remove listeners from dynamically added category buttons
      categoryContainer?.querySelectorAll('.category-btn').forEach(btn => {
           // FIX: Cast needed
           if (btn instanceof HTMLElement) {
              btn.removeEventListener('click', handleCategoryClick as EventListener);
           }
      });

      // Remove video player listeners
       if (videoPlayer) {
            videoPlayer.removeEventListener('error', handleVideoElementError);
            videoPlayer.removeEventListener('waiting', handleVideoWaiting);
            videoPlayer.removeEventListener('playing', handleVideoPlaying);
            videoPlayer.removeEventListener('canplay', handleVideoCanPlay);
            videoPlayer.removeEventListener('ended', handleVideoEnded);
       }

      // Clean up the global retry function if it exists
      if ((window as any).retryLoadData) {
          delete (window as any).retryLoadData;
          console.log("[Client] Cleaned up global retryLoadData function.");
      }

      console.log("[Client] Home Page (IPTV) component cleanup finished."); // Updated log message
    };

  }, []); // Empty dependency array: Run only once on mount and clean up on unmount

  // --- Render JSX ---
  return (
    <>
      {/* Load external scripts: HLS.js */}
      {/* `strategy="lazyOnload"` loads after the page is idle */}
      <Script
        src="https://cdn.jsdelivr.net/npm/hls.js@latest"
        strategy="lazyOnload"
        onLoad={() => console.log("[Client] HLS.js script successfully loaded via next/script.")}
        onError={(e) => console.error("[Client] Error loading HLS.js script:", e)}
      />

      {/* Manage <head> elements: Font Awesome */}
      <Head>
        <title>Xtreme Player</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        {/* Optional: Add viewport meta tag for responsiveness */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Add other head elements if needed */}
        {/* <meta name="description" content="Web-based IPTV Player using Xtreme Codes API" /> */}
      </Head>

      {/* Inline Styles using styled-jsx for component-scoped CSS */}
      {/* `global` keyword makes styles apply globally, useful for base styles/resets */}
      <style jsx global>{`
        /* Reset and Base Styles */
        html, body, #__next { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
        *, *:before, *:after { box-sizing: inherit; }
        body { background-color: #111827; /* gray-900 */ color: white; font-family: sans-serif; }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1f2937; /* gray-800 */ border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: #4b5563; /* gray-600 */ border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #6b7280; /* gray-500 */ }

        /* Grid Card Styling */
        .content-card { transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; cursor: pointer; min-height: 200px; /* Adjust as needed */ display: flex; flex-direction: column; background-color: #1f2937; /* gray-800 */ border-radius: 0.5rem; /* rounded-lg */ overflow: hidden; }
        .content-card:hover { transform: scale(1.03); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4); z-index: 10; }
        .content-card img { object-fit: cover; flex-shrink: 0; background-color: #374151; /* gray-700 placeholder */ aspect-ratio: 2/3; width: 100%; height: auto; display: block; /* Prevents bottom space */ }
        .card-info { padding: 0.5rem; /* p-2 */ margin-top: auto; flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-end; }
        .card-title-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; /* space-x-2 */ }
        .card-title-row h4 { flex-grow: 1; /* Allow title to take space */ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-icon-grid { 
          cursor: pointer; 
          padding: 0.25rem; /* p-1 */ 
          margin-left: 0.5rem; /* ml-2 */ 
          color: #d1d5db; /* gray-300 - lighter gray to be more visible */ 
          background: none; 
          border: none; 
          font-size: 1rem; /* Adjust size if needed */ 
          flex-shrink: 0; /* Prevent shrinking */
          display: flex; /* Ensure icon is always visible */
          align-items: center;
          justify-content: center;
          width: 24px; /* Fixed width */
          height: 24px; /* Fixed height */
          border-radius: 50%; /* Make it circular */
          background-color: rgba(0, 0, 0, 0.3); /* Darker background for better visibility */
        }
        .favorite-icon-grid.favorited { color: #ef4444 !important; /* red-500 with !important to override */ }
        .favorite-icon-grid:hover { color: #f3f4f6; /* gray-100 - much lighter on hover */ background-color: rgba(0, 0, 0, 0.5); }
        .favorite-icon-grid.favorited:hover { color: #f87171 !important; /* red-400 with !important */ }

        /* Modal Player Styling */
        #playerModal { transition: opacity 0.3s ease-in-out; z-index: 100; }
        #playerModal.hidden { opacity: 0; pointer-events: none; }
        #playerModal:not(.hidden) { opacity: 1; pointer-events: auto; }
        #modalContent { max-width: 90vw; max-height: 95vh; width: 850px; /* Adjust default width */ display: flex; flex-direction: column; background-color: #111827; /* gray-900 */ border-radius: 0.5rem; /* rounded-lg */ box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); overflow: hidden; }
        #modalVideoContainer { background-color: black; position: relative; width: 100%; aspect-ratio: 16/9; }
        #modalVideoContainer video { width: 100%; height: 100%; display: block; }
        #modalSeriesInfo { overflow-y: auto; background-color: #1f2937; /* gray-800 - Added BG */ flex-grow: 1; /* Allow to take remaining space */ }
        .season-selector-container { padding: 0; /* Remove default padding if needed */ }
        .episode-list { overflow-y: auto; max-height: 40vh; /* Limit episode list height */ }
        .episode-item { cursor: pointer; transition: background-color 0.2s; padding: 0.5rem 0.75rem; /* py-2 px-3 */ border-radius: 0.375rem; /* rounded-md */ margin-bottom: 0.25rem; /* mb-1 */ border-bottom: 1px solid #374151; /* border-gray-700 */ display: flex; justify-content: space-between; align-items: center; }
        .episode-item:hover { background-color: #374151; /* gray-700 */ }
        .episode-item.playing { background-color: #1d4ed8; /* blue-700 */ color: white; }
        .modal-title-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; /* space-x-4 */ }
        #modalTitle { flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-icon-modal { 
          cursor: pointer; 
          padding: 0.25rem; /* p-1 */ 
          color: #d1d5db; /* gray-300 - lighter gray to be more visible */ 
          font-size: 1.25rem; /* text-xl */ 
          background: none; 
          border: none; 
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px; /* Fixed width */
          height: 32px; /* Fixed height */
          border-radius: 50%; /* Make it circular */
          background-color: rgba(0, 0, 0, 0.3); /* Darker background for better visibility */
        }
        .favorite-icon-modal.favorited { color: #ef4444 !important; /* red-500 with !important to override */ }
        .favorite-icon-modal:hover { color: #f3f4f6; /* gray-100 - much lighter on hover */ background-color: rgba(0, 0, 0, 0.5); }
        .favorite-icon-modal.favorited:hover { color: #f87171 !important; /* red-400 with !important */ }
        #modalCloseBtn { flex-shrink: 0; }

        /* Loading Spinner */
        .loader { border: 4px solid #4b5563; /* gray-600 */ border-top: 4px solid #3b82f6; /* blue-500 */ border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 40px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Active state styling is handled by JS toggling Tailwind classes */
        /* Example active state for buttons (managed via JS) */
        /* .section-btn.active, .category-btn.active { background-color: #2563eb; color: white; } */
      `}</style>

      {/* Root Container */}
      <div className="bg-gray-900 text-white font-sans h-full flex flex-col"> {/* Ensure root takes full height */}

          {/* Login Screen - Initially visible, hidden by JS after login */}
          {/* FIX: Replaced class with className */}
          <div id="loginScreen" className="fixed inset-0 flex items-center justify-center bg-gray-900 z-[200]">
              <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md mx-4 shadow-2xl border border-gray-700">
                  <div className="text-center mb-6">
                      <i className="fas fa-sign-in-alt text-5xl text-blue-500 mb-4"></i>
                      <h1 className="text-3xl font-bold text-blue-400">Xtreme Codes Login</h1>
                      {/* FIX: Replaced class with className */}
                      <p className="text-gray-400 mt-2">Enter your credentials</p>
                  </div>
                  {/* FIX: Replaced class with className */}
                  <form id="loginForm" className="space-y-4" noValidate> {/* noValidate prevents browser validation */}
                      {/* FIX: Replaced class with className */}
                      <div className="flex space-x-2">
                          <select id="protocol" defaultValue="http://" className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 appearance-none text-sm">
                              <option value="http://">http://</option>
                              {/* <option value="https://">https://</option> */} {/* Uncomment if HTTPS needed */}
                          </select>
                          <input type="text" id="server" required placeholder="server.com:port" className="flex-grow bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                      </div>
                      <div><input type="text" id="username" required placeholder="Username" autoComplete="username" className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm" /></div>
                      <div><input type="password" id="password" required placeholder="Password" autoComplete="current-password" className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm" /></div>
                      {/* FIX: Replaced class with className */}
                      <div className="flex items-center">
                          <input type="checkbox" id="rememberMe" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-500 rounded mr-2" />
                          <label htmlFor="rememberMe" className="text-sm text-gray-400">Remember Me</label>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"> {/* Added disabled styles */}
                          <i className="fas fa-sign-in-alt mr-2"></i> Login
                      </button>
                      <div id="loginError" className="text-red-500 text-center hidden mt-3 text-sm"><i className="fas fa-exclamation-circle mr-1"></i><span id="loginErrorText">...</span></div>
                  </form>
              </div>
          </div>

          {/* Main App Structure - Hidden initially, shown by JS after login */}
          {/* FIX: Replaced class with className */}
          <div id="app" className="hidden flex flex-col h-screen"> {/* Use flex-col and h-screen */}
              {/* Header */}
              <header className="bg-gray-800 p-3 shadow-lg flex-shrink-0 sticky top-0 z-50">
                 {/* FIX: Replaced class with className */}
                 <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                      {/* FIX: Replaced class with className */}
                      <div className="flex items-center">
                          <i className="fas fa-tv text-xl text-blue-400 mr-3"></i>
                          <div>
                              <h1 className="text-lg font-bold">Xtreme Player</h1>
                              <p id="serverInfo" className="text-xs text-gray-400 truncate max-w-[150px] sm:max-w-[200px]" title="Not Connected">Not connected</p>
                          </div>
                      </div>
                      <nav className="flex space-x-2 sm:space-x-4">
                           {/* Buttons using data-type for JS hooks */}
                           {/* Initial 'active' class might be set by JS based on default section */}
                          <button data-type="live" className="section-btn px-3 py-1 rounded bg-gray-700 hover:bg-blue-700 transition text-sm">
                              <i className="fas fa-broadcast-tower mr-1"></i> Live TV
                          </button>
                          <button data-type="vod" className="section-btn px-3 py-1 rounded bg-gray-700 hover:bg-blue-700 transition text-sm"> {/* Default active TBD by JS */}
                              <i className="fas fa-film mr-1"></i> Movies
                          </button>
                          <button data-type="series" className="section-btn px-3 py-1 rounded bg-gray-700 hover:bg-blue-700 transition text-sm">
                              <i className="fas fa-video mr-1"></i> Series
                          </button>
                      </nav>
                      {/* FIX: Replaced class with className */}
                     <div className="flex items-center space-x-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                          <div className="relative flex-grow sm:flex-grow-0 sm:w-48 lg:w-64">
                              <input type="text" id="searchInput" placeholder="Search..." className="w-full bg-gray-700 text-white px-4 py-1.5 rounded-full border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 pl-9 text-sm" />
                              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                          </div>
                           <button id="favoritesBtn" title="Toggle Favorites" className="p-2 hover:bg-gray-700 rounded-lg transition text-red-500 flex items-center justify-center" style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
                              <i className="fas fa-heart"></i>
                          </button>
                          <button id="logoutBtn" title="Logout" className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition flex items-center text-sm">
                              <i className="fas fa-sign-out-alt text-xs mr-1 sm:mr-0"></i> {/* Icon smaller */}
                               <span className="hidden sm:inline ml-1">Logout</span> {/* Text visible on larger screens */}
                          </button>
                      </div>
                 </div>
              </header>

              {/* Main Content Area */}
              <main className="flex-1 overflow-y-auto p-4 container mx-auto"> {/* flex-1 and overflow-y-auto for scroll */}
                  {/* Category Buttons */}
                 <div id="categoryContainer" className="mb-4 flex flex-wrap gap-2 overflow-x-auto pb-2"> {/* Allow horizontal scroll if needed */}
                      {/* 'All' button is the baseline, others added by JS */}
                      <button className="category-btn px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm active" data-category-id="all">All</button>
                  </div>
                  {/* Content Grid */}
                  <div id="contentGrid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                       {/* Loading State */}
                       <div id="gridLoadingState" className="col-span-full text-center py-10 hidden"> {/* Initially hidden */}
                           <div className="loader"></div>
                           <p className="text-gray-500 mt-2">Loading content...</p>
                       </div>
                       {/* No Results State */}
                       <div id="noResultsState" className="col-span-full text-center py-10 hidden"> {/* Initially hidden */}
                           <i className="fas fa-search-minus text-4xl text-gray-600 mb-3"></i>
                           <p className="text-gray-500">No content found matching your criteria.</p>
                       </div>
                       {/* Content cards will be injected here by JS */}
                  </div>

              </main>
          </div>

          {/* Player Modal */}
          {/* FIX: Added z-index */}
          <div id="playerModal" className="hidden fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[150]">
              {/* FIX: Replaced class with className */}
              <div id="modalContent" className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden relative flex flex-col w-full h-full sm:w-auto sm:h-auto"> {/* Responsive size */}
                   {/* Modal Header */}
                   <div className="p-3 bg-gray-700 modal-title-row flex-shrink-0">
                      <h3 id="modalTitle" className="text-lg font-semibold truncate">Loading...</h3>
                      <div className="flex items-center">
                          <button id="modalFavoriteBtn" title="Add/Remove Favorite" className="favorite-icon-modal">
                              <i className="far fa-heart"></i> {/* Icon changes via JS */}
                          </button>
                          <button id="modalCloseBtn" title="Close Player" className="text-gray-300 hover:text-white text-2xl leading-none ml-2">×</button>
                      </div>
                  </div>
                   {/* Video Container */}
                  <div id="modalVideoContainer" className="w-full bg-black relative flex-grow"> {/* Allow video container to grow */}
                      {/* Video Player */}
                      <video id="videoPlayer" controls playsInline className="w-full h-full bg-black" />
                       {/* Player Error Overlay */}
                       <div id="playerError" className="absolute inset-x-0 bottom-0 bg-red-600 bg-opacity-90 text-white p-3 text-sm hidden flex items-center justify-center shadow-lg z-10">
                          <i className="fas fa-exclamation-triangle mr-2"></i>
                          <span id="playerErrorText">Playback Error</span>
                      </div>
                       {/* Player Loading Spinner Overlay */}
                       <div id="playerLoading" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 hidden z-20"> {/* Ensure spinner is above video */}
                           <div className="w-12 h-12 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
                       </div>
                  </div>
                   {/* Series Info Container (shown instead of video for series selection) */}
                   {/* FIX: Replaced class with className */}
                   <div id="modalSeriesInfo" className="flex-grow bg-gray-900 overflow-y-auto hidden">
                       {/* Content (like season selector, episode list) injected by JS */}
                       <p className="text-center text-gray-400 p-4">Loading series details...</p> {/* Default text */}
                   </div>
              </div>
          </div>
      </div>
    </>
  );
}
