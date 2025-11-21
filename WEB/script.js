// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoic3JpeWF0aG90YWt1cmEiLCJhIjoiY21kYzhuMG1hMTVrbjJpcHpnZ3Awdjc1dCJ9.bEGwdPmOH5kVaT9RWduC5Q';

// Aggressive Mapbox analytics blocking
(function() {
    // Block XMLHttpRequest to analytics endpoints
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && url.includes('events.mapbox.com')) {
            // Prevent the request from being sent
            this._blocked = true;
            return;
        }
        return originalXHROpen.call(this, method, url, ...args);
    };
    
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        if (this._blocked) {
            return;
        }
        return originalXHRSend.call(this, data);
    }
    
    // Block fetch requests to analytics endpoints
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
        const url = typeof resource === 'string' ? resource : resource.url;
        if (typeof url === 'string' && url.includes('events.mapbox.com')) {
            return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
        }
        return originalFetch.call(this, resource, options);
    };
})();

// Suppress Mapbox analytics errors in console
const originalConsoleError = console.error;
console.error = function(...args) {
    const message = args[0];
    if (typeof message === 'string' && 
        (message.includes('events.mapbox.com') || 
         message.includes('ERR_BLOCKED_BY_CLIENT') ||
         (message.includes('POST') && message.includes('events.mapbox.com')) ||
         (message.includes('ajax.js:149') && message.includes('events.mapbox.com')))) {
        return; // Suppress Mapbox analytics errors
    }
    // Also suppress any error objects that contain Mapbox analytics URLs
    if (message && typeof message === 'object' && message.stack && 
        message.stack.includes('events.mapbox.com')) {
        return;
    }
    return originalConsoleError.apply(console, args);
};

// Also suppress any console.log messages that contain analytics errors
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = args[0];
    if (typeof message === 'string' && 
        (message.includes('events.mapbox.com') || 
         message.includes('ERR_BLOCKED_BY_CLIENT') ||
         (message.includes('ajax.js:149') && message.includes('events.mapbox.com')))) {
        return; // Suppress Mapbox analytics errors in log too
    }
    return originalConsoleLog.apply(console, args);
};

// Also suppress Mapbox analytics warnings
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
    const message = args[0];
    if (typeof message === 'string' && 
        (message.includes('events.mapbox.com') || 
         message.includes('ERR_BLOCKED_BY_CLIENT') ||
         message.includes('setLight') && message.includes('deprecated') ||
         message.includes('setLights not supported') ||
         message.includes('prefer using map.setLights'))) {
        return; // Suppress Mapbox warnings
    }
    return originalConsoleWarn.apply(console, args);
};

// Global variables for scrollama
let currentLegend = null;

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-74.0060, 40.7128],
    zoom: 9,
    pitch: 0,
    bearing: 0,
    hash: false,
    interactive: true,
    // Disable zoom controls and gestures
    scrollZoom: false,
    boxZoom: false,
    doubleClickZoom: false,
    dragZoom: false,
    touchZoomRotate: false,
    // Hide zoom controls
    zoomControl: false,
    // Disable Mapbox analytics to prevent ERR_BLOCKED_BY_CLIENT errors
    collectResourceTiming: false,
    fadeDuration: 0
});

// Show loading state
const loadingEl = document.createElement('div');
loadingEl.className = 'map-loading';
loadingEl.textContent = 'Loading map data...';
document.body.appendChild(loadingEl);

// Wait for the map to load
map.on('load', () => {
    console.log("Map has loaded! Configuring map...");

    // Set up map lighting using the new setLights API
    try {
        map.setLights({
            'flat': {
                'anchor': 'viewport',
                'color': '#FFFFFF',
                'intensity': 0.6,
                'position': [135, 60, 0]
            }
        });
    } catch (e) {
        // Fallback to deprecated setLight if setLights fails
        console.warn('setLights not supported, falling back to setLight');
        map.setLight({
            'anchor': 'viewport',
            'color': '#FFFFFF',
            'intensity': 0.6,
            'position': [135, 60, 0]
        });
    }

    console.log("Map lighting configured. Adding data layers...");

    // 1. Add park_lots (Green spaces)
    map.addSource('park-lots-source', { 
        type: 'geojson', 
        data: 'data/park_lots.geojson'
    });
    
    map.addLayer({
        'id': 'park-lots-layer',
        'type': 'fill',
        'source': 'park-lots-source',
        'paint': {
            'fill-color': '#FBDBD9',
            'fill-opacity': 1.0,
            'fill-outline-color': '#E47675'
        }
    }, 'waterway-label'); // Draw above water labels

    // 2. Add E-designation Polygons
    map.addSource('E-designation-source', {
        type: 'geojson',
        data: 'data/E-Designation.geojson' 
    });

    // 3. Add Impervious Density Polygons
    map.addSource('imp-density-source', {
        type: 'geojson',
        data: 'data/Imp_Density.geojson' 
    });

    map.addLayer({
        'id': 'E-designation',
        'type': 'line',
        'source': 'E-designation-source',
        'paint': {
            'line-color': '#FFFF00', // Bright Yellow
            'line-width': 1.5,
            'line-dasharray': [2, 1] // Creates the dashed line effect
        },
        'layout': {
            'visibility': 'none' // Hidden until called in a scroll step
        }
    }, 'waterway-label'); // Draw above water labels

    // 3.1. Add Impervious Density Layer
    map.addLayer({
        'id': 'imp-density-layer',
        'type': 'fill',
        'source': 'imp-density-source',
        'paint': {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'Imp_Density'],
                0, '#B8D4E8', // Darker blue for low density
                25, '#7FA5C7', // Medium blue-grey
                50, '#4A5F7A', // Dark blue-grey
                75, '#2C3E50', // Very dark grey
                100, '#1A252F' // Darkest blue-grey
            ],
            'fill-opacity': 0.8,
            'fill-outline-color': '#333333'
        },
        'layout': {
            'visibility': 'none' // Hidden until called in a scroll step
        }
    }, 'waterway-label'); // Draw above water labels

    // 2.1. Add Asthma Index Rates
    map.addSource('asthma-index-source', { 
        type: 'geojson', 
        data: 'data/Asthma_Index_Rates.geojson'
    });
    
    // Check if asthma data loaded correctly
    setTimeout(() => {
        const features = map.querySourceFeatures('asthma-index-source');
        console.log(`Asthma data check: ${features.length} features loaded`);
        
        if (features.length > 0) {
            console.log('✓ Asthma data loaded successfully!');
            console.log('📍 Sample feature properties:', Object.keys(features[0].properties));
            console.log('🎯 Layer should now be visible in step 4!');
        } else {
            console.log('⚠️ Asthma data not loaded - checking file path');
            // Try to check if the source exists
            const source = map.getSource('asthma-index-source');
            if (source) {
                console.log('✓ Asthma source exists but has no features');
                // Try to manually load the data
                fetch('data/Asthma_Index_Rates.geojson')
                    .then(response => {
                        console.log('📁 File response status:', response.status);
                        return response.json();
                    })
                    .then(data => {
                        console.log('📊 Manual data load:', data.features?.length || 0, 'features');
                        if (data.features && data.features.length > 0) {
                            // Update the source with loaded data
                            map.getSource('asthma-index-source').setData(data);
                            console.log('✓ Asthma source updated with manual data');
                        }
                    })
                    .catch(error => {
                        console.error('❌ Error loading asthma data:', error);
                    });
            } else {
                console.log('❌ Asthma source not found in map');
            }
        }
    }, 2000);
    
    map.addLayer({
        'id': 'asthma-index-layer',
        'type': 'fill',
        'source': 'asthma-index-source',
        'paint': {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'Asthma_I_R'], 0],
                0, 'rgba(240,240,240,0)',
                50, '#f0f0f0',
                100, '#d0d0d0',
                150, '#b0b0b0',
                200, '#909090',
                250, '#707070',
                300, '#505050',
                350, '#303030',
                400, '#000000'
            ],
            'fill-opacity': 0.1,
            'fill-outline-color': '#333'
        }
    }, 'waterway-label'); // Draw above water labels

    // 3. Add Freight Routes
    map.addSource('freight-routes-source', {
        type: 'geojson',
        data: 'data/Freight_Routes.geojson'
    });

    map.addLayer({
        'id': 'freight-routes-layer',
        'type': 'line',
        'source': 'freight-routes-source',
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#e10600',
            'line-width': 1,
            'line-opacity': 0.8
        }
    });

    // 3.1. Add Asthma Hexagonal Data
    map.addSource('asthma-hex-source', {
        type: 'geojson',
        data: 'data/Asthma_Hotspots_Hexagons.geojson' 
    });

    map.addLayer({
        'id': 'asthma-hex-fill',
        'type': 'fill',
        'source': 'asthma-hex-source',
        'paint': {
            // Style based on the calculated mean field from your Turf.js script
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'Asthma_I_R_mean'], // This field name is confirmed in the file
                0, 'rgba(0,0,0,0)',        // Transparent for 0/no data
                0.5, '#8B0000',             // Dark Red (low end)
                1.0, '#E10600'              // Alarm Red (high end)
            ],
            'fill-opacity': 0.8,
            'fill-outline-color': '#FFFFFF' // White stroke for visibility
        },
        'layout': {
            // Initial visibility is set to 'none'. Scrollama will turn it 'visible'.
            'visibility': 'none' 
        }
    }, 'freight-routes-layer'); // Ensure it draws above the base map but below any critical lines

    // 3.5. Add Freight Zones
    map.addSource('freight-zones-source', {
        type: 'geojson',
        data: 'data/zones_fr.geojson'
    });

    map.addLayer({
        'id': 'freight-zones-layer',
        'type': 'line',
        'source': 'freight-zones-source',
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#e10600',
            'line-width': 6,
            'line-opacity': 1.0,
            'line-blur': 2
        }
    }, 'freight-routes-layer');

    // 3.5. Add Traffic Hotspots
    map.addSource('traffic-hotspots-source', {
        type: 'geojson',
        data: 'data/Traffic_Hotspots.geojson'
    });

    map.addLayer({
        'id': 'traffic-hotspots-layer',
        'type': 'heatmap',
        'source': 'traffic-hotspots-source',
        'paint': {
            'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'Total_Traffic'], 500], // Use 500 as fallback for null values
                500, 0.5,
                700, 0.8,
                900, 1.0
            ],
            'heatmap-intensity': 3,
            'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(225, 6, 0, 0)',        // #e10600 - fade to transparent
                0.2, 'rgba(210, 8, 5, 0.4)',     // #d20805 - light fade
                0.4, 'rgba(183, 12, 15, 0.6)',    // #b70c0f - medium fade
                0.6, 'rgba(165, 15, 21, 0.8)',    // #a50f15 - stronger fade
                0.8, 'rgba(255, 0, 0, 1.0)',      // #ff0000 - strong fade, full opacity
                0.9, 'rgba(220, 20, 20, 1.0)',    // shaded red core
                1, 'rgba(200, 40, 40, 1.0)'     // small shaded red core
            ],
            'heatmap-radius': 150,
            'heatmap-opacity': 1.0
        }
    }, 'freight-routes-layer');

    // 4. Add Junction Hotspots
    map.addSource('junction-hotspots-source', {
        type: 'geojson',
        data: 'data/Junction_hotspots.geojson'  // Note: Case-sensitive filename
    });

    map.addLayer({
        'id': 'junction-hotspots-layer',
        'type': 'heatmap',
        'source': 'junction-hotspots-source',
        'paint': {
            'heatmap-weight': 0.5,
            'heatmap-intensity': 0.5,
            'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(33, 113, 181, 0)',        // #2171b5 - fade to transparent
                0.1, 'rgba(33, 113, 181, 0.2)',     // #2171b5 - very light fade
                0.2, 'rgba(33, 113, 181, 0.3)',     // #2171b5 - light fade
                0.3, 'rgba(52, 152, 219, 0.4)',     // #3498db - medium blue fade
                0.4, 'rgba(41, 128, 185, 0.35)',    // #2980b9 - blue fade
                0.45, 'rgba(52, 73, 94, 0.35)',     // #34495e - blue-gray transition
                0.5, 'rgba(142, 68, 173, 0.4)',     // #8e44ad - purple fade
                0.55, 'rgba(127, 64, 155, 0.35)',    // #7f409b - purple-blue transition
                0.6, 'rgba(155, 89, 182, 0.3)',     // #9b59b6 - light purple fade
                0.65, 'rgba(155, 89, 155, 0.35)',    // #9b599b - purple-red transition
                0.7, 'rgba(139, 0, 0, 0.3)',        // #8b0000 - dark red fade
                0.75, 'rgba(119, 0, 0, 0.35)',       // #770000 - darker red fade
                0.8, 'rgba(99, 0, 0, 0.4)',          // #630000 - very dark red fade
                0.85, 'rgba(79, 0, 0, 0.35)',        // #4f0000 - extremely dark red fade
                0.9, 'rgba(59, 0, 0, 0.3)',          // #3b0000 - ultra dark red fade
                0.95, 'rgba(39, 0, 0, 0.25)',        // #270000 - faint dark red fade
                1, 'rgba(19, 0, 0, 0.2)'             // #130000 - very faint dark red core
            ],
            'heatmap-radius': 100,
            'heatmap-opacity': 0.000001
        }
    }, 'freight-routes-layer');

    // 5. Add Vulnerable Facilities
    map.addSource('vulnerable-facilities-source', {
        type: 'geojson',
        data: 'data/Vulnerability_facilities.geojson'  // Updated filename
    });
    
    // Check if vulnerable facilities data loaded correctly
    setTimeout(() => {
        const features = map.querySourceFeatures('vulnerable-facilities-source');
        console.log(`Vulnerable facilities data check: ${features.length} features loaded`);
        
        if (features.length > 0) {
            console.log('✓ Vulnerable facilities data loaded successfully!');
            console.log('📍 Sample feature properties:', Object.keys(features[0].properties));
            console.log('🎯 Facilities should now be visible in designated steps!');
        } else {
            console.log('⚠️ Vulnerable facilities data not loaded - checking file path');
            // Try to check if the source exists
            const source = map.getSource('vulnerable-facilities-source');
            if (source) {
                console.log('✓ Vulnerable facilities source exists but has no features');
                // Try to manually load the data
                fetch('data/Vulnerability_facilities.geojson')
                    .then(response => {
                        console.log('📁 Facilities file response status:', response.status);
                        return response.json();
                    })
                    .then(data => {
                        console.log('📊 Manual facilities data load:', data.features?.length || 0, 'features');
                        if (data.features && data.features.length > 0) {
                            // Update the source with loaded data
                            map.getSource('vulnerable-facilities-source').setData(data);
                            console.log('✓ Vulnerable facilities source updated with manual data');
                            console.log('🏥 Facility types found:', [...new Set(data.features.map(f => f.properties.f_type))]);
                        }
                    })
                    .catch(error => {
                        console.error('❌ Error loading vulnerable facilities data:', error);
                    });
            } else {
                console.log('❌ Vulnerable facilities source not found in map');
            }
        }
    }, 2000);

    map.addLayer({
        'id': 'vulnerable-facilities-layer',
        'type': 'circle',
        'source': 'vulnerable-facilities-source',
        'paint': {
            'circle-radius': 8,
            'circle-color': [
                'match',
                ['get', 'f_type'],
                'Hospital', '#ffffff',      
                'School', '#adadad',       
                'Day Care', '#000000',      
                '#FFFFFF'                  // Default white for other types
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#000000',
            'circle-opacity': 1,
            'circle-blur': 1
        }
    }, 'traffic-hotspots-layer');

    // Check if vulnerable facilities layer was added successfully
    setTimeout(() => {
        if (map.getLayer('vulnerable-facilities-layer')) {
            console.log('✓ Vulnerable facilities layer added successfully!');
        } else {
            console.log('⚠️ Vulnerable facilities layer not found in map');
        }
    }, 1000);

    // 6. Add Residential Areas
    map.addSource('residential-source', {
        type: 'geojson',
        data: 'data/residential.geojson'
    });

    map.addLayer({
        'id': 'residential-layer',
        'type': 'fill',
        'source': 'residential-source',
        'paint': {
            'fill-color': '#FBDBD9',
            'fill-opacity': 0,
            'fill-outline-color': '#FBDBD9'
        },
        'layout': {
            'visibility': 'none'
        }
    }, 'traffic-hotspots-layer');

    // Create diagonal pattern image
    const diagonalPattern = new Image();
    diagonalPattern.src = 'data:image/svg+xml;base64,' + btoa(`
        <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="diagonal" patternUnits="userSpaceOnUse" width="10" height="10">
                    <rect width="10" height="10" fill="transparent"/>
                    <path d="M0,10 L10,0 M-5,5 L5,-5 M15,15 L25,5" stroke="#FBDBD9" stroke-width="1" opacity="0.4"/>
                </pattern>
            </defs>
            <rect width="10" height="10" fill="url(#diagonal)"/>
        </svg>
    `);
    
    diagonalPattern.onload = function() {
        map.addImage('diagonal-pattern', diagonalPattern);
    };

    // Create diagonal pattern with colored background for other scrolls
    const diagonalPatternWithBackground = new Image();
    diagonalPatternWithBackground.src = 'data:image/svg+xml;base64,' + btoa(`
        <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="diagonal-with-bg" patternUnits="userSpaceOnUse" width="10" height="10">
                    <rect width="10" height="10" fill="#FBDBD9"/>
                    <path d="M0,10 L10,0 M-5,5 L5,-5 M15,15 L25,5" stroke="#ffffff" stroke-width="1" opacity="0.6"/>
                </pattern>
            </defs>
            <rect width="10" height="10" fill="url(#diagonal-with-bg)"/>
        </svg>
    `);
    
    diagonalPatternWithBackground.onload = function() {
        map.addImage('diagonal-pattern-with-bg', diagonalPatternWithBackground);
    };

    // Add residential line layer for dotted white stroke
    map.addLayer({
        'id': 'residential-stroke-layer',
        'type': 'line',
        'source': 'residential-source',
        'paint': {
            'line-color': '#FFFFFF',
            'line-width': 1.5,
            'line-dasharray': [2, 4], // Dotted pattern
            'line-opacity': 0.8
        },
        'layout': {
            'visibility': 'none' // Hidden initially
        }
    }, 'traffic-hotspots-layer');

    // Add residential layer with diagonal pattern
    map.addLayer({
        'id': 'residential-diagonal-layer',
        'type': 'fill',
        'source': 'residential-source',
        'paint': {
            'fill-pattern': 'diagonal-pattern',
            'fill-opacity': 0.6
        },
        'layout': {
            'visibility': 'none' // Hidden initially
        }
    }, 'traffic-hotspots-layer');

    // Add residential layer with diagonal pattern and colored background (for other scrolls)
    map.addLayer({
        'id': 'residential-diagonal-bg-layer',
        'type': 'fill',
        'source': 'residential-source',
        'paint': {
            'fill-pattern': 'diagonal-pattern-with-bg',
            'fill-opacity': 0.8
        },
        'layout': {
            'visibility': 'none' // Hidden initially
        }
    }, 'traffic-hotspots-layer');

    // 7. Add CVI 3D Extrusion Layer with data filtering
fetch('data/CVI_hex.geojson')
    .then(response => response.json())
    .then(data => {
        // Process features to ensure CVI_mean is a valid number
        const processedData = {
            ...data,
            features: data.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    // Ensure CVI_mean is a valid number, default to 0 if not
                    CVI_mean: feature.properties.CVI_mean !== null && 
                            !isNaN(parseFloat(feature.properties.CVI_mean)) ?
                            parseFloat(feature.properties.CVI_mean) : 0
                }
            }))
        };

        // Add the source with processed data
        map.addSource('cvi-source', {
            type: 'geojson',
            data: processedData
        });

        // Add the layer after data is processed
        map.addLayer({
            'id': 'cvi-3d-extrusion',
            'type': 'fill-extrusion',
            'source': 'cvi-source',
            'paint': {
                // A. EXTRUSION HEIGHT: Base the height on the CVI mean score
                'fill-extrusion-height': [
                    'interpolate', 
                    ['exponential', 2.5], // More aggressive exponential curve
                    ['get', 'CVI_mean'], 
                    -1.0, 100,       // Higher base for better visibility
                    0.0, 100,        // Flat base up to 0
                    0.1, 300,        // Early rise
                    0.3, 1000,       // Steeper mid-range
                    0.6, 2000,       // Sharp increase
                    1.0, 4000,       // Very high for upper range
                    2.0, 5000        // Maximum dramatic height (5000m)
                ],
                // B. EXTRUSION COLOR: Use the specified red gradient (#8B0000 to #E10600)
                'fill-extrusion-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'CVI_mean'],
                    -1.0, '#8B0000',  // Dark Red (low/negative CVI)
                    0, '#8B0000',     // Dark Red for 0
                    2.0, '#E10600'    // Alarm Red (high CVI)
                ],
                'fill-extrusion-opacity': 0.9 // High opacity for 3D
            },
            'layout': {
                'visibility': 'none' // Hidden until Scrollama reveals it
            }
        }, 'traffic-hotspots-layer');

        console.log('CVI 3D layer added with processed data');
        
        // --- SCROLL 8: INTERVENTION ZONES (SOLUTION LAYER) ---
        // Load intervention zones after CVI layer is successfully added
        return fetch('data/Intervention_Zones_3D.geojson');
    })
    .then(response => response.json())
    .then(data => {
        // Process features to ensure CVI_mean is a valid number and filter out zeros
        const processedData = {
            ...data,
            features: data.features
                .filter(feature => {
                    const cviMean = feature.properties.CVI_mean;
                    return cviMean !== null && 
                           !isNaN(parseFloat(cviMean)) && 
                           parseFloat(cviMean) > 0;
                })
                .map(feature => ({
                    ...feature,
                    properties: {
                        ...feature.properties,
                        CVI_mean: parseFloat(feature.properties.CVI_mean)
                    }
                }))
        };

        // 1. Add Source
        map.addSource('intervention-source', {
            type: 'geojson',
            data: processedData
        });

        // 2. Add the 3D Extrusion Layer (Pillars)
        map.addLayer({
    'id': 'intervention-3d-extrusion',
    'type': 'fill-extrusion',
    'source': 'intervention-source',
    'paint': {
        // A. EXTRUSION HEIGHT: This defines the top of the pillar. Keep the existing height scale.
        'fill-extrusion-height': [
            'interpolate', ['exponential', 2.5], 
            ['get', 'CVI_mean'], 
            -1.0, 100,      
            0.0, 100,       
            0.1, 300,       
            0.3, 1000,      
            0.6, 2000,      
            1.0, 4000,      
            2.0, 5000       
        ],
        // B. EXTRUSION BASE: *** CRITICAL CHANGE *** Set the base to 0 to start from the ground.
        'fill-extrusion-base': 0, // FIXED VALUE: Always starts at ground level
        
        // C. EXTRUSION COLOR: Changed to the pink/red color from your snippet
        'fill-extrusion-color': '#F28A8A', 
        'fill-extrusion-opacity': 1.0 
    },
    'layout': {
        'visibility': 'none' // Initially hidden
    }
}, 'cvi-3d-extrusion'); // Keep stacking above CVI if desired, though now they overlap completely.

        console.log('Intervention zones layer added successfully');
        
        // --- SCROLL 9: FINAL RESILIENCE SOLUTION LAYER (2D) ---
        map.addSource('resilience-source', {
            type: 'geojson',
            data: 'data/resilience_solution_areas.geojson' // The renamed file
        });

        map.addLayer({
            'id': 'resilience-fill',
            'type': 'fill', // Important: This is a 2D layer
            'source': 'resilience-source',
            'paint': {
                'fill-color': '#F28A8A', // Clear green for "Canopy Gain"
                'fill-opacity': 0.15, // Low opacity for subtle background
                'fill-outline-color': 'rgba(255, 0, 0, 0.8)' // Defined outline with high opacity for the paper map aesthetic
            },
            'layout': {
                'visibility': 'none' // Hidden until Scroll 9
            }
        }); // Place at top of layer stack
        
        console.log('Resilience solution layer added successfully');
    })
    .catch(error => {
        console.error('Error loading data:', error);
    });

    // --- SCROLL 11: SECONDARY INTERVENTION (RESIDENTIAL BIVARIATE) ---
    map.addSource('secondary-source', {
        type: 'geojson',
        data: 'data/Secondary_Intervention_Residential.geojson' 
    });

    map.addLayer({
        'id': 'resilience-bivariate-fill',
        'type': 'fill', 
        'source': 'secondary-source',
        'paint': {
            'fill-opacity': 0.9,
            'fill-outline-color': '#FFFFFF',
            // Bivariate color logic for Canopy % vs Asthma Index (3-tier priority system)
            'fill-color': [
                'case',
                // ----------------------------------------------------
                // 1. ASTHMA HIGH PRIORITY (E.g., > 200) - Use gray to green gradient
                ['>=', ['get', 'Asthma_I_R_mean_mean_majority'], 200], 
                [
                    'case',
                    ['<=', ['get', 'Canopy_Pct_majority'], 5], '#404040', // High Asthma / Low Canopy (Dark Gray - MAX PRIORITY)
                    ['<=', ['get', 'Canopy_Pct_majority'], 10], '#7a8c3d', // High Asthma / Mid Canopy (Yellow-Green)
                    '#295229' // High Asthma / High Canopy (Dark Green)
                ],
                // ----------------------------------------------------
                // 2. ASTHMA MEDIUM PRIORITY (E.g., 150 - 200) - Use lighter gray to green
                ['>=', ['get', 'Asthma_I_R_mean_mean_majority'], 150], 
                [
                    'case',
                    ['<=', ['get', 'Canopy_Pct_majority'], 5], '#808080', // Mid Asthma / Low Canopy (Medium Gray)
                    ['<=', ['get', 'Canopy_Pct_majority'], 10], '#a3b868', // Mid Asthma / Mid Canopy (Light Yellow-Green)
                    '#4d8c4d' // Mid Asthma / High Canopy (Medium Green)
                ],
                // ----------------------------------------------------
                // 3. ASTHMA LOW PRIORITY (Default below 150) - Use lightest gray to green
                [
                    'case',
                    ['<=', ['get', 'Canopy_Pct_majority'], 5], '#bfbfbf', // Low Asthma / Low Canopy (Light Gray)
                    ['<=', ['get', 'Canopy_Pct_majority'], 10], '#c9d4a3', // Low Asthma / Mid Canopy (Very Light Yellow-Green)
                    '#99cc99' // Low Asthma / High Canopy (Light Green)
                ]
            ]
        },
        'layout': {
            'visibility': 'none'
        }
    }, 'waterway-label');

    console.log('Secondary intervention bivariate layer added successfully');

    // --- SCROLL 12: SECONDARY INTERVENTION (RESIDENTIAL TRIVARIATE) ---
    map.addSource('secondary-residential-source', {
        type: 'geojson',
        data: 'data/Secondary_Intervention_Residential_TRIVARIATE.geojson' 
    });

    map.addLayer({
        'id': 'resilience-trivariate-fill',
        'type': 'fill', 
        'source': 'secondary-residential-source',
        'paint': {
            'fill-outline-color': '#FFFFFF', // White outline for contrast
            
            // 1. FILL-COLOR: TRIVARIATE (Asthma vs. Canopy vs. CVI) - Earthy Feral Atlas palette
            'fill-color': [
                'case',
                // --- HIGH CVI VULNERABILITY (>= 2.0) - Use Rust/Brown tones ---
                ['>=', ['coalesce', ['get', 'CVI_mean'], 0], 2.0],
                [
                    'case',
                    // High Asthma + Low Canopy = Deep Rust Brown (MAX PRIORITY)
                    ['all', ['>=', ['coalesce', ['get', 'Asthma_mean'], 0], 2.0], ['<=', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#5C1A1A',
                    // High Asthma + High Canopy = Terra Cotta
                    ['all', ['>=', ['coalesce', ['get', 'Asthma_mean'], 0], 2.0], ['>', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#8B3A3A',
                    // Low Asthma + Low Canopy = Earthy Brown
                    ['all', ['<', ['coalesce', ['get', 'Asthma_mean'], 0], 1.5], ['<=', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#664B3C',
                    // Low Asthma + High Canopy = Sandy Brown
                    '#8B7355'
                ],
                // --- MEDIUM CVI VULNERABILITY (>= 1.0) - Use Ochre/Gold tones ---
                ['>=', ['coalesce', ['get', 'CVI_mean'], 0], 1.0],
                [
                    'case',
                    // High Asthma + Low Canopy = Dark Goldenrod
                    ['all', ['>=', ['coalesce', ['get', 'Asthma_mean'], 0], 2.0], ['<=', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#8B6914',
                    // High Asthma + High Canopy = Golden Ochre
                    ['all', ['>=', ['coalesce', ['get', 'Asthma_mean'], 0], 2.0], ['>', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#B8860B',
                    // Low Asthma + Low Canopy = Wheat
                    ['all', ['<', ['coalesce', ['get', 'Asthma_mean'], 0], 1.5], ['<=', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#C2A756',
                    // Low Asthma + High Canopy = Pale Gold
                    '#D4AF6A'
                ],
                // --- LOW CVI VULNERABILITY - Use Green/Mint tones ---
                [
                    'case',
                    // High Asthma + Low Canopy = Forest Green
                    ['all', ['>=', ['coalesce', ['get', 'Asthma_mean'], 0], 2.0], ['<=', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#2F5233',
                    // High Asthma + High Canopy = Sage Green
                    ['all', ['>=', ['coalesce', ['get', 'Asthma_mean'], 0], 2.0], ['>', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#4A7C59',
                    // Low Asthma + Low Canopy = Seafoam
                    ['all', ['<', ['coalesce', ['get', 'Asthma_mean'], 0], 1.5], ['<=', ['coalesce', ['get', 'Canopy_mean'], 0], 10]], '#5A8F7B',
                    // Low Asthma + High Canopy = Mint Green (best case)
                    '#7DB09B'
                ]
            ],
            
            // 2. FILL-OPACITY: Fixed for visibility
            'fill-opacity': 0.8
        },
        'layout': {
            'visibility': 'none' // Hidden initially
        }
    }, 'waterway-label');

    console.log('Secondary intervention trivariate layer added successfully');

    // --- SCROLL 12: MAX PRIORITY OVERLAY ---
    map.addSource('max-priority-source', {
        type: 'geojson',
        data: 'data/Secondary_Intervention_Residential.geojson' 
    });

    // --- SCROLL 15: CITY TYPE ANALYSIS ---
    map.addSource('city-type-source', {
        type: 'geojson',
        data: 'data/City_Type.geojson'
    });

    map.addLayer({
        'id': 'resilience-max-priority-fill',
        'type': 'line', 
        'source': 'max-priority-source',
        'filter': [
            'all', 
            ['>=', ['get', 'Asthma_I_R_mean_mean_majority'], 200],
            ['<=', ['get', 'Canopy_Pct_majority'], 5]
        ],
        'paint': {
            'line-color': '#FF0000', // Bright red
            'line-width': 3,
            'line-opacity': 0.9
        },
        'layout': {
            'visibility': 'none' // Hidden initially
        }
    }, 'waterway-label');

    console.log('Max priority overlay layer added successfully');

    // --- SCROLL 15: CITY TYPE LAYER ---
    map.addLayer({
        'id': 'city-type-fill',
        'type': 'fill',
        'source': 'city-type-source',
        'paint': {
            'fill-color': [
                'match',
                ['get', 'City_Type'],
                'Gray City', '#808080',
                'Green City', '#228B22',
                'Feral City', '#8B4513',
                'Human City', '#4169E1',
                '#CCCCCC' // Default color
            ],
            'fill-opacity': 0.7
        },
        'layout': {
            'visibility': 'none' // Hidden initially
        }
    }, 'waterway-label');

    console.log('City type layer added successfully');

    // Add map controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.addControl(new mapboxgl.ScaleControl());

// Add 3D buildings layer - Place above base map layers
map.addLayer({
    'id': '3d-buildings',
    'source': 'composite',
    'source-layer': 'building',
    'filter': ['==', 'extrude', 'true'],
    'type': 'fill-extrusion',
    'minzoom': 15,
    'paint': {
        'fill-extrusion-color': '#1E1E1E',
        'fill-extrusion-height': [
            "interpolate", ["linear"], ["zoom"],
            15, 0,
            15.05, ["get", "height"]
        ],
        'fill-extrusion-base': [
            "interpolate", ["linear"], ["zoom"],
            15, 0,
            15.05, ["get", "min_height"]
        ],
        'fill-extrusion-opacity': 0.8
    }
});  // Removed the 'water-layer-id' reference
    
    // Create popup for hexagonal layer interactivity
    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    // Add mouse events for hexagonal layer
    map.on('mouseenter', 'asthma-hex-fill', (e) => {
        // Change cursor to pointer
        map.getCanvas().style.cursor = 'pointer';
        
        // Get features at the clicked point
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['asthma-hex-fill']
        });
        
        if (!features.length) return;
        
        const feature = features[0];
        const asthmaRate = feature.properties.Asthma_I_R_mean;
        
        // Format the popup content
        const popupContent = `
            <div style="padding: 8px; font-family: Arial, sans-serif;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">Asthma Hotspot</h3>
                <p style="margin: 0; font-size: 12px;">
                    <strong>Mean Index Rate:</strong> ${asthmaRate ? asthmaRate.toFixed(2) : 'N/A'}
                </p>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">
                    Click for more details
                </p>
            </div>
        `;
        
        // Set popup content and coordinates
        popup.setLngLat(e.lngLat)
             .setHTML(popupContent)
             .addTo(map);
    });

    map.on('mouseleave', 'asthma-hex-fill', () => {
        // Reset cursor
        map.getCanvas().style.cursor = '';
        // Remove popup
        popup.remove();
    });

    map.on('click', 'asthma-hex-fill', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['asthma-hex-fill']
        });
        
        if (!features.length) return;
        
        const feature = features[0];
        const asthmaRate = feature.properties.Asthma_I_R_mean;
        
        // Create detailed popup for click
        const detailedPopup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true
        });
        
        const detailedContent = `
            <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 200px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: bold; color: #333;">
                    Asthma Hotspot Details
                </h3>
                <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 14px;">
                        <strong>Mean Index Rate:</strong><br>
                        <span style="font-size: 18px; color: #E10600; font-weight: bold;">
                            ${asthmaRate ? asthmaRate.toFixed(2) : 'N/A'}
                        </span>
                    </p>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                    This hexagon represents the aggregated asthma index rate for this area.
                </p>
            </div>
        `;
        
        detailedPopup.setLngLat(e.lngLat)
                   .setHTML(detailedContent)
                   .addTo(map);
    });
    
    // Remove loading state
    if (document.querySelector('.map-loading')) {
        document.body.removeChild(loadingEl);
    }

    // Initialize scrollytelling after a longer delay to ensure all layers are loaded
    setTimeout(() => {
        // Scrollama is now initialized in the map.on('load') event
        console.log('Map and layers fully loaded');
    }, 1500);
});

// Scrollytelling configuration
const storySteps = {
    // Step 1.0: Scroll 1 Intro - Full NYC view with all pollution layers visible
    0: {
        center: [-74.0060, 40.7128], // Approximate center of NYC
        zoom: 9,
        layers: [
            ['park-lots-layer', 'visible', 1.0], // Parks (Full opacity)
            ['asthma-index-layer', 'none', 0], // Asthma (Choropleth)
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['freight-routes-layer', 'none', 0], // Freight Routes (Red Lines)
            ['freight-zones-layer', 'none', 0], // Freight Zones (Orange Lines)
            ['traffic-hotspots-layer', 'visible', 0.8], // Traffic Hotspots (Heatmap)
            ['junction-hotspots-layer', 'visible', 0.8], // Idling Hotspots (Heatmap)
            ['vulnerable-facilities-layer', 'none', 0], // (hidden)
            ['residential-layer', 'none', 0], // Residential Areas (Hidden)
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    1: { // Same as 0, serves as the explicit start step for Scroll 1
        center: [-74.0060, 40.7128],
        zoom: 9,
        layers: [
            ['park-lots-layer', 'visible', 1.0],
            ['asthma-index-layer', 'visible', 0.7],
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['freight-routes-layer', 'visible', 0.8],
            ['freight-zones-layer', 'visible', 0.7],
            ['traffic-hotspots-layer', 'visible', 0.8],
            ['junction-hotspots-layer', 'visible', 0.8],
            ['vulnerable-facilities-layer', 'none', 0],
            ['residential-layer', 'none', 0],
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    2: { // Traffic Hotspots Focus - Show only traffic hotspots
        center: [-73.88, 40.85], // Center on South Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'none', 0],
            ['asthma-index-layer', 'none', 0],
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['freight-routes-layer', 'none', 0],
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'visible', 1.0], // Only Traffic Hotspots visible
            ['junction-hotspots-layer', 'visible', 1.0], // Junction Hotspots also visible
            ['vulnerable-facilities-layer', 'none', 0],
            ['residential-layer', 'none', 0],
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    3: { // Scroll 1 Focus - Zoom to Bronx to show local problem
        center: [-73.88, 40.85], // Center on South Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'visible', 1.0],
            ['asthma-index-layer', 'none', 0],
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['freight-routes-layer', 'visible', 0.8],
            ['freight-zones-layer', 'visible', 0.7],
            ['traffic-hotspots-layer', 'visible', 0.8],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 1.0],
            ['residential-layer', 'visible', 0.6], // Show residential areas with solid fill
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    4: { // Freight Routes Only - Show only freight routes and zones
        center: [-73.88, 40.85], // Center on South Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'none', 0],
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['asthma-index-layer', 'visible', 0.7], // Asthma Index below freight layers
            ['freight-routes-layer', 'visible', 1.0], // Freight Routes prominent
            ['freight-zones-layer', 'visible', 1.0], // Freight Zones prominent
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'none', 0],
            ['residential-layer', 'none', 0],
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    5: { // Freight Focus - Show freight zones, routes, and asthma hex
        center: [-73.88, 40.85], // Center on South Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'none', 0],
            ['asthma-index-layer', 'none', 0],
            ['asthma-hex-fill', 'visible', 0.8], // Show Asthma Hex prominently
            ['freight-routes-layer', 'visible', 1.0], // Freight Routes prominent
            ['freight-zones-layer', 'visible', 1.0], // Freight Zones prominent
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'none', 0],
            ['residential-layer', 'none', 0],
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    6: { // Health Burden Focus - Isolate Health Burden layers, fade Freight/Hotspots
        center: [-73.88, 40.85], // Stay in Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'visible', 1.0], // Parks still visible
            ['asthma-index-layer', 'visible', 0.8], // Keep Asthma prominent
            ['asthma-hex-fill', 'visible', 0.6], // Show Asthma Hex with medium opacity
            ['freight-routes-layer', 'visible', 0.4], // Freight faded
            ['freight-zones-layer', 'visible', 0.4], // Freight zones faded
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.6], // Facilities visible but faded
            ['residential-layer', 'none', 0],
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    7: { // E-destination - Electric Vehicle Infrastructure Planning
        center: [-73.88, 40.85], // Stay in Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'visible', 0.8], // Parks visible but faded
            ['asthma-index-layer', 'visible', 0.6], // Asthma visible but faded
            ['asthma-hex-fill', 'none', 0], // Hide Asthma Hex
            ['freight-routes-layer', 'visible', 0.3], // Freight very faded
            ['freight-zones-layer', 'visible', 0.3], // Freight zones very faded
            ['traffic-hotspots-layer', 'visible', 0.5], // Traffic hotspots visible for EV charging analysis
            ['junction-hotspots-layer', 'visible', 0.5], // Junction hotspots visible for EV charging analysis
            ['vulnerable-facilities-layer', 'visible', 0.8], // Facilities visible for EV proximity analysis
            ['residential-layer', 'visible', 0.3], // Residential areas visible for EV infrastructure planning
            ['E-designation', 'visible', 1.0], // E-designation polygons visible
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    8: { // Impervious Surface Density Analysis
        center: [-73.88, 40.85], // Stay in Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'visible', 0.8], // Parks visible (will be set to white)
            ['asthma-index-layer', 'none', 0], // Hide health layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'none', 0], // Hide freight layers
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0], // Hide traffic layers
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'none', 0], // Hide facilities
            ['residential-layer', 'none', 0], // Hide residential
            ['E-designation', 'none', 0], // Hide E-designation
            ['cvi-3d-extrusion', 'none', 0], // CVI 3D hidden
            ['resilience-bivariate-fill', 'none', 0], // Hide bivariate layer
            ['imp-density-layer', 'visible', 0.9] // Impervious density prominent
        ]
    },
    9: { // Environmental Impact Assessment
        center: [-73.88, 40.85], // Stay in Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'visible', 0.8], // Parks visible
            ['asthma-index-layer', 'visible', 0.5], // Show health data
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'visible', 0.3], // Freight as background
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0], // Hide traffic layers
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.7], // Show facilities
            ['residential-layer', 'none', 0], // Hide residential
            ['E-designation', 'none', 0], // Hide E-designation
            ['cvi-3d-extrusion', 'none', 0], // CVI 3D hidden
            ['resilience-bivariate-fill', 'none', 0], // Hide bivariate layer
            ['imp-density-layer', 'none', 0] // Hide impervious density
        ]
    },
    10: { // Sustainability Solutions Planning
        center: [-73.88, 40.85], // Stay in Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'visible', 1.0], // Parks prominent
            ['asthma-index-layer', 'visible', 0.3], // Health data faded
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'none', 0], // Hide freight
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0], // Hide traffic layers
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.5], // Show facilities
            ['residential-layer', 'visible', 0.4], // Show residential areas
            ['E-designation', 'none', 0], // Hide E-designation
            ['cvi-3d-extrusion', 'none', 0], // CVI 3D hidden
            ['resilience-bivariate-fill', 'none', 0], // Hide bivariate layer
            ['imp-density-layer', 'none', 0] // Hide impervious density
        ]
    },
    11: { // CVI Layer (Starting point - flat 2D)
        center: [-73.95, 40.85], 
        zoom: 11,
        // No pitch or bearing defined (or set to 0), so the global function uses 0/0.
        layers: [
            ['park-lots-layer', 'visible', 0.3], // Parks faded
            ['asthma-index-layer', 'none', 0], // Hide other layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'visible', 0.2], // Freight very faded
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.4], // Facilities visible but faded
            ['residential-layer', 'visible', 0.1], // Residential very faded with solid fill
            ['cvi-3d-extrusion', 'visible', 0.9], // CVI 3D prominent
            ['resilience-bivariate-fill', 'none', 0] // Hide bivariate layer
        ]
    },
    12: { // Intervention (Flat 2D Introduction - same as scroll 9)
        center: [-73.95, 40.85], // Same center as CVI
        zoom: 11,
        // No pitch or bearing defined (flat 2D view, same as scroll 7)
        layers: [
            ['park-lots-layer', 'visible', 0.3], // Parks faded (same as scroll 7)
            ['asthma-index-layer', 'none', 0], // Hide other layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'visible', 0.2], // Freight very faded
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.4], // Facilities visible but faded
            ['residential-layer', 'visible', 0.3], // Residential visible
            ['E-designation', 'none', 0], // Hide E-designation
            ['cvi-3d-extrusion', 'visible', 0.3], // CVI problem areas visible
            ['resilience-bivariate-fill', 'none', 0], // Hide bivariate layer
            ['imp-density-layer', 'none', 0], // Hide impervious density
            ['intervention-3d-extrusion', 'visible', 1.0] // Intervention zones prominent
        ]
    },
    13: { // Resilience Solutions - 3D Intervention View (same perspective as scroll 8)
        center: [-73.95, 40.85], // Same center as CVI
        zoom: 11,
        pitch: 45,
        bearing: 0,
        layers: [
            ['park-lots-layer', 'visible', 0.2], // Parks very faded
            ['asthma-index-layer', 'none', 0], // Hide other layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'visible', 0.1], // Freight barely visible
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.3], // Facilities faded
            ['residential-layer', 'visible', 0.1], // Residential very faded with solid fill
            ['cvi-3d-extrusion', 'visible', 0.8], // CVI problem areas visible
            ['intervention-3d-extrusion', 'visible', 0.8], // Intervention zones visible
            ['resilience-fill', 'none', 0], // Resilience solutions visible in 3D
            ['resilience-bivariate-fill', 'none', 0] // Hide bivariate layer
        ]
    },
    14: { // Resilience Solutions - Final 2D canopy gain areas
        center: [-73.95, 40.78], // Same center as intervention step
        zoom: 10.5,
        pitch: 0, // Return to 2D view
        bearing: 0,
        layers: [
            ['park-lots-layer', 'visible', 0.3], // Parks visible for context
            ['asthma-index-layer', 'none', 0], // Hide other layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'visible', 0.2], // Freight faded
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.5], // Facilities visible
            ['residential-layer', 'none', 0], // Residential faded
            ['cvi-3d-extrusion', 'none', 0], // Hide CVI 3D
            ['intervention-3d-extrusion', 'none', 0], // Hide intervention 3D
            ['resilience-fill', 'visible', 0.5], // Show resilience solutions with reduced opacity
            ['resilience-bivariate-fill', 'none', 0], // Hide bivariate layer
            ['imp-density-layer', 'none', 0] // Hide impervious density
        ]
    },
    15: { // Secondary Intervention - Residential Bivariate Analysis
        center: [-73.95, 40.78], // Same center as scroll 10
        zoom: 10.5, // Same zoom as scroll 10
        pitch: 0, // 2D view for bivariate analysis
        bearing: 0,
        layers: [
            ['park-lots-layer', 'none', 0], // Hide all other layers
            ['asthma-index-layer', 'none', 0],
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'none', 0],
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'none', 0],
            ['residential-layer', 'none', 0],
            ['cvi-3d-extrusion', 'none', 0],
            ['intervention-3d-extrusion', 'none', 0],
            ['resilience-fill', 'visible', 0.15], // Show resilience solutions as faded background
            ['resilience-bivariate-fill', 'visible', 0.5], // Show bivariate analysis prominently
            ['imp-density-layer', 'none', 0] // Hide impervious density
        ]
    },
    16: { // Secondary Intervention - Residential Trivariate Analysis
        center: [-73.95, 40.80], // Center on analysis area
        zoom: 12,
        pitch: 0,          // Return to 2D
        bearing: 0,
        layers: [
            // Hide all 3D layers and previous risk visualizations
            ['cvi-3d-extrusion', 'none', 0], 
            ['intervention-3d-extrusion', 'none', 0], 
            ['resilience-fill', 'none', 0], // Hide the previous solution layer
            ['resilience-bivariate-fill', 'none', 0], // Hide bivariate layer
            ['3d-buildings', 'none', 0], // Hide 3D buildings layer
            ['city-type-fill', 'none', 0], // Hide city type layer
            ['imp-density-layer', 'none', 0], // Hide impervious density

            // Show the new Trivariate Residential layer prominently
            ['resilience-trivariate-fill', 'visible', 1.0], // Opacity is driven by data
            ['resilience-max-priority-fill', 'visible', 0.7], // Show max priority overlay

            // Optional context layers (e.g., roads, base map labels)
            ['residential-layer', 'visible', 0.2], // Fade residential context with solid fill
            ['park-lots-layer', 'visible', 0.5] // Show park context
        ]
    },
    17: { // City Type Analysis
        center: [-73.95, 40.80], // Same center as step 14
        zoom: 12,               // Same zoom as step 14
        pitch: 0,          // 2D view
        bearing: 0,
        layers: [
            // Hide ALL layers except city type
            ['cvi-3d-extrusion', 'none', 0], 
            ['intervention-3d-extrusion', 'none', 0], 
            ['resilience-fill', 'none', 0],
            ['resilience-bivariate-fill', 'none', 0],
            ['resilience-trivariate-fill', 'none', 0],
            ['resilience-max-priority-fill', 'none', 0],
            ['3d-buildings', 'none', 0],
            ['residential-layer', 'visible', 0.1], // Show residential fill with minimal opacity to see outline
            ['residential-diagonal-layer', 'visible', 0.6], // Show diagonal pattern
            ['residential-stroke-layer', 'none', 0], // Hide dotted stroke
            ['park-lots-layer', 'none', 0], // Hide park context
            ['vulnerable-facilities-layer', 'none', 0], // Hide facility context
            ['asthma-index-layer', 'none', 0], // Hide other layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'none', 0],
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['imp-density-layer', 'none', 0], // Hide impervious density

            // Only show City Type layer
            ['city-type-fill', 'visible', 1.0]
        ]
    }
};

// Initialize Scrollama
function initializeScrollama() {
    try {
        const scroller = scrollama();

        scroller
            .setup({
                step: '.step',
                offset: 0.5,
                progress: true,
                debug: false
            })
            .onStepEnter(response => {
                // Validate response object (direction can be undefined on first load)
                if (!response || !response.element || typeof response.index !== 'number') {
                    console.error('Invalid scrollama response:', response);
                    return;
                }

                // Handle legend switching
                if (currentLegend) {
                    currentLegend.classList.remove('active');
                }
                
                const legendId = 'legend-' + (response.index + 1);
                currentLegend = document.getElementById(legendId);
                if (currentLegend) {
                    currentLegend.classList.add('active');
                }
                    
                // Hide previous layers when scrolling to a new one
                if (map && map.getLayer) {
                    try {
                        if (map.getLayer('asthma-hex-fill')) {
                            map.setLayoutProperty('asthma-hex-fill', 'visibility', 'none');
                        }
                        if (map.getLayer('cvi-3d-extrusion')) {
                            map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'none');
                        }
                        if (map.getLayer('intervention-3d-extrusion')) {
                            map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'none');
                        }
                        if (map.getLayer('resilience-fill')) {
                            map.setLayoutProperty('resilience-fill', 'visibility', 'none');
                        }
                        if (map.getLayer('resilience-bivariate-fill')) {
                            map.setLayoutProperty('resilience-bivariate-fill', 'visibility', 'none');
                        }
                        if (map.getLayer('resilience-trivariate-fill')) {
                            map.setLayoutProperty('resilience-trivariate-fill', 'visibility', 'none');
                        }
                        if (map.getLayer('resilience-max-priority-fill')) {
                            map.setLayoutProperty('resilience-max-priority-fill', 'visibility', 'none');
                        }
                    } catch (layerError) {
                        console.warn('Error hiding layers:', layerError);
                    }
                }

                console.log('Entering step:', response.index, response.element.id);
                const stepDataIndex = response.element.getAttribute('data-step');
                
                if (!stepDataIndex) {
                    console.warn('Step element missing data-step attribute:', response.element);
                    return;
                }
                
                // Update active step styling
                document.querySelectorAll('.step').forEach(el => el.classList.remove('is-active'));
                response.element.classList.add('is-active');

        if (response.element.id === 'scroll-5-cvi-step') { 
            // 1. Reveal the 3D extrusion layer
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'visible');
                map.setPaintProperty('cvi-3d-extrusion', 'fill-extrusion-opacity', 0.9);
            }
            
            // 2. Set the 3D View (Camera Pitch and Bearing)
            map.flyTo({
                center: [-73.95, 40.78], // Focus over central NYC
                pitch: 80,                // Near-vertical view (almost straight down)
                bearing: -45,             // Diagonal angle for better depth perception
                zoom: 10.5,
                duration: 2500,           // Slightly longer for dramatic effect
                curve: 1.2,               // More pronounced curve in flight path
                essential: true
            });
            } else if (response.element.id === 'scroll-8-imp-density-step') { 
            console.log('Entering Scroll 8: Impervious Surface Density Analysis');
            
            // Show impervious density layer
            if (map.getLayer('imp-density-layer')) {
                map.setLayoutProperty('imp-density-layer', 'visibility', 'visible');
                map.setPaintProperty('imp-density-layer', 'fill-opacity', 0.8);
            }

                // The map.flyTo is called *outside* this block using the flat 2D pitch:0/bearing:0 from the stepData!
        } else if (response.element.id === 'scroll-11-resilience-3d-step') {
            // 1. Show CVI Problem layer (red pillars) for context
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'visible');
            }
            
            // 2. Show Intervention layer (yellow pillars)
            if (map.getLayer('intervention-3d-extrusion')) {
                map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'visible');
            }
            
            // 3. Show Resilience solutions layer
            if (map.getLayer('resilience-fill')) {
                map.setLayoutProperty('resilience-fill', 'visibility', 'visible');
            }
            
            // 4. Maintain same 3D camera view as scroll 8
            map.flyTo({
                pitch: 50,         // Same pitch as scroll 8
                bearing: -30,      // Same bearing as scroll 8
                zoom: 12,
                duration: 1500
            });
        } else if (response.element.id === 'scroll-13-resilience-step') {
            console.log('Entering Scroll 10: Final Resilience Solution');
            
            // 1. Hide ALL 3D problem/solution layers (the transition from drama to calm)
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('intervention-3d-extrusion')) {
                map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('3d-buildings')) { // Hide the base map buildings too
                map.setLayoutProperty('3d-buildings', 'visibility', 'none');
            }

            // 2. Reveal the new 2D Solution Layer
            if (map.getLayer('resilience-fill')) {
                map.setLayoutProperty('resilience-fill', 'visibility', 'visible');
            }

            // 3. Transition to the 2D, overhead "Paper Map" view
            map.flyTo({
                center: [-73.95, 40.75], 
                pitch: 0,             // Crucial: Returns to 2D
                bearing: 0,           // Removes rotation
                zoom: 11,
                duration: 3000
            });
            
            // Optional: Switch to a light map style for the "paper map" effect
            // map.setStyle('mapbox://styles/mapbox/light-v11'); 
        } else if (response.element.id === 'scroll-14-secondary-intervention-step') {
            console.log('Entering Scroll 11: Secondary Intervention - Residential Bivariate Analysis');
            
            // 1. Hide ALL 3D and other layers to focus on bivariate
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('intervention-3d-extrusion')) {
                map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('3d-buildings')) {
                map.setLayoutProperty('3d-buildings', 'visibility', 'none');
            }
            if (map.getLayer('resilience-fill')) {
                map.setLayoutProperty('resilience-fill', 'visibility', 'none');
            }
            
            // 2. Reveal the bivariate layer
            if (map.getLayer('resilience-bivariate-fill')) {
                map.setLayoutProperty('resilience-bivariate-fill', 'visibility', 'visible');
            }
            
            // 3. Fly to South Bronx residential areas for detailed analysis
            map.flyTo({
                center: [-73.88, 40.85],
                pitch: 0,             // 2D view for bivariate analysis
                bearing: 0,           // North-up orientation
                zoom: 12,
                duration: 2000
            }); 
        } else if (response.element.id === 'scroll-15-trivariate-solutions') {
            // Hide all previous layers
            if (map.getLayer('asthma-hex-fill')) {
                map.setLayoutProperty('asthma-hex-fill', 'visibility', 'none');
            }
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('intervention-3d-extrusion')) {
                map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('resilience-fill')) {
                map.setLayoutProperty('resilience-fill', 'visibility', 'none');
            }
            if (map.getLayer('resilience-bivariate-fill')) {
                map.setLayoutProperty('resilience-bivariate-fill', 'visibility', 'none');
            }
            if (map.getLayer('resilience-trivariate-fill')) {
                map.setLayoutProperty('resilience-trivariate-fill', 'visibility', 'none');
            }
            if (map.getLayer('city-type-fill')) {
                map.setLayoutProperty('city-type-fill', 'visibility', 'none');
            }

            // Fade residential and park layers for context
            if (map.getLayer('residential-fill')) {
                map.setPaintProperty('residential-fill', 'fill-opacity', 0.3);
            }
            if (map.getLayer('park-fill')) {
                map.setPaintProperty('park-fill', 'fill-opacity', 0.3);
            }

            // Initialize vanilla JavaScript heatmap
            const container = document.getElementById('trivariate-heatmap');
            if (container && !container.hasChildNodes()) {
                const heatmap = window.createTrivariateHeatmap();
                container.appendChild(heatmap);
            }
        } else if (response.element.id === 'scroll-16-city-type-step') {
            console.log('Entering Scroll 15: City Type Analysis');
            
            // Hide ALL layers except city type
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('intervention-3d-extrusion')) {
                map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'none');
            }
            if (map.getLayer('resilience-fill')) {
                map.setLayoutProperty('resilience-fill', 'visibility', 'none');
            }
            if (map.getLayer('resilience-bivariate-fill')) {
                map.setLayoutProperty('resilience-bivariate-fill', 'visibility', 'none');
            }
            if (map.getLayer('resilience-trivariate-fill')) {
                map.setLayoutProperty('resilience-trivariate-fill', 'visibility', 'none');
            }
            if (map.getLayer('resilience-max-priority-fill')) {
                map.setLayoutProperty('resilience-max-priority-fill', 'visibility', 'none');
            }
            if (map.getLayer('3d-buildings')) {
                map.setLayoutProperty('3d-buildings', 'visibility', 'none');
            }
            if (map.getLayer('residential-layer')) {
                map.setLayoutProperty('residential-layer', 'visibility', 'visible');
                map.setPaintProperty('residential-layer', 'fill-opacity', 0.1);
            }
            if (map.getLayer('residential-diagonal-layer')) {
                map.setLayoutProperty('residential-diagonal-layer', 'visibility', 'visible');
                map.setPaintProperty('residential-diagonal-layer', 'fill-opacity', 0.6);
            }
            if (map.getLayer('residential-stroke-layer')) {
                map.setLayoutProperty('residential-stroke-layer', 'visibility', 'none');
            }
            if (map.getLayer('park-lots-layer')) {
                map.setLayoutProperty('park-lots-layer', 'visibility', 'none');
            }
            if (map.getLayer('vulnerable-facilities-layer')) {
                map.setLayoutProperty('vulnerable-facilities-layer', 'visibility', 'none');
            }
            if (map.getLayer('asthma-index-layer')) {
                map.setLayoutProperty('asthma-index-layer', 'visibility', 'none');
            }
            if (map.getLayer('asthma-hex-fill')) {
                map.setLayoutProperty('asthma-hex-fill', 'visibility', 'none');
            }
            if (map.getLayer('freight-routes-layer')) {
                map.setLayoutProperty('freight-routes-layer', 'visibility', 'none');
            }
            if (map.getLayer('freight-zones-layer')) {
                map.setLayoutProperty('freight-zones-layer', 'visibility', 'none');
            }
            if (map.getLayer('traffic-hotspots-layer')) {
                map.setLayoutProperty('traffic-hotspots-layer', 'visibility', 'none');
            }
            if (map.getLayer('junction-hotspots-layer')) {
                map.setLayoutProperty('junction-hotspots-layer', 'visibility', 'none');
            }

            // Show ONLY City Type layer
            if (map.getLayer('city-type-fill')) {
                map.setLayoutProperty('city-type-fill', 'visibility', 'visible');
            }

            // Fly to same area as step 14 for city type overview
            map.flyTo({
                center: [-73.95, 40.80], // Same center as step 14
                pitch: 0,             // 2D view
                bearing: 0,           // North-up orientation
                zoom: 12,             // Same zoom as step 14
                duration: 2000
            });
        } else if (response.element.id === 'step-7') {
                // CVI 3D Extrusion step - show CVI 3D layer prominently with 3D perspective
                console.log('Showing CVI 3D extrusion layer');
                if (map.getLayer('cvi-3d-extrusion')) {
                    map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'visible');
                    map.setPaintProperty('cvi-3d-extrusion', 'fill-extrusion-opacity', 0.9);
                }
                // Set 3D perspective for dramatic effect
                map.flyTo({
                    center: [-73.88, 40.85],
                    zoom: 12,
                    pitch: 45,
                    bearing: 0,
                    duration: 1500 
                });
            } else if (response.element.id === 'step-5') {
                // Freight Focus step - show hexagonal asthma layer prominently
                console.log('Showing asthma hexagonal layer for Freight Focus step');
                if (map.getLayer('asthma-hex-fill')) {
                    map.setLayoutProperty('asthma-hex-fill', 'visibility', 'visible');
                    map.setPaintProperty('asthma-hex-fill', 'fill-opacity', 0.8);
                }
            } else if (response.element.id === 'step-6') {
                // Health Burden step - show hexagonal layer with medium opacity
                console.log('Showing asthma hexagonal layer for Health Burden step');
                if (map.getLayer('asthma-hex-fill')) {
                    map.setLayoutProperty('asthma-hex-fill', 'visibility', 'visible');
                    map.setPaintProperty('asthma-hex-fill', 'fill-opacity', 0.6);
                }
            } else if (response.element.id === 'scroll-6-intervention-step') { 
                // 1. Ensure the CVI Problem layer (red pillars) is visible for context
                if (map.getLayer('cvi-3d-extrusion')) {
                    map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'visible');
                }
                
                // 2. Reveal the Solution layer (yellow pillars)
                if (map.getLayer('intervention-3d-extrusion')) {
                    map.setLayoutProperty('intervention-3d-extrusion', 'visibility', 'visible');
                }
                
                // 3. Maintain 3D camera view and zoom slightly
                map.flyTo({
                     pitch: 70, 
                     bearing: -20, 
                     zoom: 11,
                     duration: 1500
                });
            }
            
            // Update map state
            updateMap(stepDataIndex);
        })
        .onStepExit(response => {
            console.log('Exiting step:', response.index);
            
            // Hide residential-diagonal-layer when exiting scroll 16 (step 15)
            if (response.index === 15) {
                if (map.getLayer('residential-diagonal-layer')) {
                    map.setLayoutProperty('residential-diagonal-layer', 'visibility', 'none');
                }
            }
        });

        // Handle window resize
        function handleResize() {
            console.log('Handling resize...');
            try {
                if (scroller && typeof scroller.resize === 'function') {
                    scroller.resize();
                }
            } catch (resizeError) {
                console.warn('Error resizing scrollama:', resizeError);
            }
        }

        // Add resize event listener with error handling
        window.addEventListener('resize', handleResize);
        
        // Set initial state
        console.log('Setting initial state...');
        try {
            updateMap('0');
            const firstStep = document.querySelector('.step');
            if (firstStep) {
                firstStep.classList.add('is-active');
            }
        } catch (initError) {
            console.error('Error setting initial state:', initError);
        }
        
        // Force resize to ensure proper calculation
        setTimeout(() => {
            try {
                if (scroller && typeof scroller.resize === 'function') {
                    scroller.resize();
                    console.log('Scrollama initialized successfully');
                }
            } catch (resizeError) {
                console.warn('Error in initial resize:', resizeError);
            }
        }, 100);
    } catch (error) {
        console.error('Error initializing Scrollama:', error);
    }
}

// Call the initialization function after map is loaded
map.on('load', () => {
    // Wait a bit more for all layers to be ready
    setTimeout(() => {
        initializeScrollama();
    }, 1000);
});

// Update map based on current step
function updateMap(stepIndex) {
    const stepData = storySteps[stepIndex];
    if (!stepData) {
        console.warn('No step data for index:', stepIndex);
        return;
    }

    console.log('Updating to step:', stepIndex, stepData);

    // Validate zoom level
    const zoom = stepData.zoom;
    if (typeof zoom !== 'number' || zoom < 0 || zoom > 20) {
        console.warn('Invalid zoom level for step', stepIndex, ':', zoom, 'using default');
        stepData.zoom = 10; // Default fallback
    }

    // Validate center coordinates
    if (!stepData.center || !Array.isArray(stepData.center) || stepData.center.length !== 2) {
        console.warn('Invalid center coordinates for step', stepIndex, ':', stepData.center, 'using default');
        stepData.center = [-74.0060, 40.7128]; // NYC default
    }

    // Fly to new camera position with error handling
    try {
        map.flyTo({
            center: stepData.center,
            zoom: stepData.zoom,
            pitch: stepData.pitch !== undefined ? stepData.pitch : 0, 
            bearing: stepData.bearing !== undefined ? stepData.bearing : 0,
            speed: 1.2,
            curve: 1.42,
            essential: true
        });
    } catch (error) {
        console.error('Error flying to step', stepIndex, ':', error);
        // Fallback to jumpTo if flyTo fails
        try {
            map.jumpTo({
                center: stepData.center,
                zoom: stepData.zoom,
                pitch: stepData.pitch !== undefined ? stepData.pitch : 0,
                bearing: stepData.bearing !== undefined ? stepData.bearing : 0
            });
        } catch (jumpError) {
            console.error('Error jumping to step', stepIndex, ':', jumpError);
        }
    }

    // Explicit layer visibility control for imp-density-layer
    if (stepIndex == 8) {
        map.setLayoutProperty('imp-density-layer', 'visibility', 'visible');
        map.setPaintProperty('imp-density-layer', 'fill-opacity', 0.8);
        console.log('imp-density-layer explicitly set to visible for step 8');
    } else {
        map.setLayoutProperty('imp-density-layer', 'visibility', 'none');
        console.log('imp-density-layer explicitly set to hidden for step', stepIndex);
    }

    // Explicit layer visibility control for E-designation layer
    if (stepIndex == 7) {
        map.setLayoutProperty('E-designation', 'visibility', 'visible');
        map.setPaintProperty('E-designation', 'line-opacity', 1.0);
        console.log('E-designation explicitly set to visible for step 7');
    } else {
        map.setLayoutProperty('E-designation', 'visibility', 'none');
        console.log('E-designation explicitly set to hidden for step', stepIndex);
    }

    // Explicit layer visibility control for residential-diagonal-layer
    if (stepIndex == 15) {
        // Step 15 (scroll 16) should show the diagonal layer
        console.log('residential-diagonal-layer allowed for step 15');
    } else {
        // All other steps should hide the diagonal layer
        if (map.getLayer('residential-diagonal-layer')) {
            map.setLayoutProperty('residential-diagonal-layer', 'visibility', 'none');
            console.log('residential-diagonal-layer explicitly set to hidden for step', stepIndex);
        }
    }

    // Update layer visibility and opacity
    stepData.layers.forEach(([layerId, visibility, opacity]) => {
        if (map.getLayer(layerId)) {
            // Debug logging for asthma-index-layer
            if (layerId === 'asthma-index-layer') {
                console.log(`Asthma Index Layer: visibility=${visibility}, opacity=${opacity}`);
            }
            
            // Update visibility
            map.setLayoutProperty(layerId, 'visibility', visibility);

            // Explicit control for E-designation layer visibility
            if (layerId === 'E-designation') {
                console.log('Processing E-designation layer - stepIndex:', stepIndex, 'visibility:', visibility);
                if (stepIndex == 7) {
                    map.setLayoutProperty('E-designation', 'visibility', 'visible');
                    map.setPaintProperty('E-designation', 'line-opacity', 1.0);
                    console.log('E-designation layer set to visible for step 7');
                } else {
                    map.setLayoutProperty('E-designation', 'visibility', 'none');
                    console.log('E-designation layer set to hidden for step', stepIndex);
                }
            }

            // Explicit control for imp-density-layer visibility
            if (layerId === 'imp-density-layer') {
                console.log('Processing imp-density-layer - stepIndex:', stepIndex, 'visibility:', visibility);
                if (stepIndex == 8) {
                    map.setLayoutProperty('imp-density-layer', 'visibility', 'visible');
                    map.setPaintProperty('imp-density-layer', 'fill-opacity', 0.8);
                    console.log('imp-density-layer set to visible for step 8');
                } else {
                    map.setLayoutProperty('imp-density-layer', 'visibility', 'none');
                    console.log('imp-density-layer set to hidden for step', stepIndex);
                }
            }

            // Only update opacity for visible layers
            if (visibility === 'visible' && opacity !== null && opacity !== undefined) {
                // Update opacity based on layer type
                const layerType = map.getLayer(layerId).type;
                const opacityProp = {
                    'fill': 'fill-opacity',
                    'line': 'line-opacity',
                    'circle': 'circle-opacity',
                    'heatmap': 'heatmap-opacity',
                    'fill-extrusion': 'fill-extrusion-opacity'
                }[layerType];

                if (opacityProp) {
                    try {
                        map.setPaintProperty(layerId, opacityProp, opacity);
                        if (layerId === 'asthma-index-layer') {
                            console.log(`Asthma Index Layer: set ${opacityProp} to ${opacity}`);
                        }
                    } catch (error) {
                        console.warn(`Could not set ${opacityProp} for layer ${layerId}:`, error);
                    }
                }
            }
        } else {
            console.warn(`Layer ${layerId} not found in map`);
        }
    });

    // Special handling for step 7: change traffic hotspot colors to grey (after layer updates)
    console.log('Checking stepIndex:', stepIndex, 'for traffic hotspot color change');
    if (stepIndex == 7) {
        // Check if traffic-hotspots-layer exists and should be visible in step 7
        if (map.getLayer('traffic-hotspots-layer')) {
            // Check step data to see if traffic-hotspots-layer should be visible
            const trafficStepData = stepData.layers.find(([layerId]) => layerId === 'traffic-hotspots-layer');
            console.log('Step 7 traffic data found:', trafficStepData);
            if (trafficStepData && trafficStepData[1] === 'visible') {
                console.log('Step 7: Applying grey colors to traffic hotspots');
                map.setPaintProperty('traffic-hotspots-layer', 'heatmap-color', [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(128, 128, 128, 0)',        // Grey - fade to transparent
                    0.2, 'rgba(128, 128, 128, 0.4)',     // Grey - very light fade
                    0.4, 'rgba(105, 105, 105, 0.6)',     // Darker grey - medium fade
                    0.6, 'rgba(85, 85, 85, 0.8)',        // Dark grey - stronger fade
                    0.8, 'rgba(64, 64, 64, 1.0)',        // Dark grey - full opacity
                    0.9, 'rgba(45, 45, 45, 1.0)',        // Very dark grey core
                    1, 'rgba(32, 32, 32, 1.0)'           // Darkest grey core
                ]);
                console.log('Step 7: Traffic hotspot colors changed to grey');
            } else {
                console.log('Step 7: Traffic hotspot layer not visible in step data');
            }
        } else {
            console.log('Step 7: Traffic hotspot layer not found');
        }

        // Special handling for step 7: change park lots to bright grey with white stroke
        if (map.getLayer('park-lots-layer')) {
            const parkStepData = stepData.layers.find(([layerId]) => layerId === 'park-lots-layer');
            if (parkStepData && parkStepData[1] === 'visible') {
                console.log('Step 7: Applying bright grey fill and white stroke to park lots');
                map.setPaintProperty('park-lots-layer', 'fill-color', '#D3D3D3'); // Bright grey
                map.setPaintProperty('park-lots-layer', 'fill-outline-color', '#FFFFFF'); // White stroke
                console.log('Step 7: Park lots colors changed to bright grey with white stroke');
            }
        }

        // Special handling for step 7: change freight routes to thicker black strokes
        if (map.getLayer('freight-routes-layer')) {
            const freightStepData = stepData.layers.find(([layerId]) => layerId === 'freight-routes-layer');
            if (freightStepData && freightStepData[1] === 'visible') {
                console.log('Step 7: Applying thicker black strokes to freight routes');
                map.setPaintProperty('freight-routes-layer', 'line-color', '#000000'); // Black
                map.setPaintProperty('freight-routes-layer', 'line-width', 4); // Thicker stroke
                console.log('Step 7: Freight routes changed to thicker black strokes');
            }
        }

    } else {
        // Restore original red colors for all other steps
        if (map.getLayer('traffic-hotspots-layer')) {
            map.setPaintProperty('traffic-hotspots-layer', 'heatmap-color', [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(225, 6, 0, 0)',        // #e10600 - fade to transparent
                0.2, 'rgba(210, 8, 5, 0.4)',     // #d20805 - light fade
                0.4, 'rgba(183, 12, 15, 0.6)',    // #b70c0f - medium fade
                0.6, 'rgba(165, 15, 21, 0.8)',    // #a50f15 - stronger fade
                0.8, 'rgba(255, 0, 0, 1.0)',      // #ff0000 - strong fade, full opacity
                0.9, 'rgba(220, 20, 20, 1.0)',    // shaded red core
                1, 'rgba(200, 40, 40, 1.0)'       // small shaded red core
            ]);
            console.log('Step', stepIndex, ': Traffic hotspot colors restored to red');
        }

    // Special park color control for step 8 (after all layer processing)
    if (stepIndex == 8) {
        if (map.getLayer('park-lots-layer')) {
            map.setPaintProperty('park-lots-layer', 'fill-color', '#FFFFFF'); // White for step 8
            map.setPaintProperty('park-lots-layer', 'fill-outline-color', '#FFFFFF'); // White stroke
            console.log('Step 8: Park lots set to white with white stroke');
        }
    }

    // Restore original park lots colors for all other steps (except step 8)
    if (stepIndex != 8) {
        if (map.getLayer('park-lots-layer')) {
            map.setPaintProperty('park-lots-layer', 'fill-color', '#FBDBD9'); // Original light pink
            map.setPaintProperty('park-lots-layer', 'fill-outline-color', '#E47675'); // Original darker pink
            console.log('Step', stepIndex, ': Park lots colors restored to original pink');
        }
    }

        // Restore original freight routes colors for all other steps
        if (map.getLayer('freight-routes-layer')) {
            map.setPaintProperty('freight-routes-layer', 'line-color', '#e10600'); // Original red
            map.setPaintProperty('freight-routes-layer', 'line-width', 1); // Original width
            console.log('Step', stepIndex, ': Freight routes restored to original red');
        }
    }
}
