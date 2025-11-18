// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoic3JpeWF0aG90YWt1cmEiLCJhIjoiY21kYzhuMG1hMTVrbjJpcHpnZ3Awdjc1dCJ9.bEGwdPmOH5kVaT9RWduC5Q';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-74.0060, 40.7128],
    zoom: 9,
    pitch: 0,
    bearing: 0,
    hash: false,
    interactive: true
});

// Show loading state
const loadingEl = document.createElement('div');
loadingEl.className = 'map-loading';
loadingEl.textContent = 'Loading map data...';
document.body.appendChild(loadingEl);

// Wait for the map to load
map.on('load', () => {
    console.log("Map has loaded! Configuring map...");

    // Set up map lighting
    map.setLight({
        // Directional Light (creates strong shadows)
        'anchor': 'viewport', // Light direction remains fixed relative to the screen
        'color': '#FFFFFF',
        'intensity': 0.6, // Overall brightness
        'position': [135, 60, 0] // Direction: [azimuth (0=N, 90=E), pitch (0=flat, 90=overhead), range]
    }, 
    // Ambient Light (subtle fill light for all surfaces)
    {
        'anchor': 'viewport',
        'color': '#AAAAAA', // Light gray ambient color
        'intensity': 0.4
    });

    console.log("Map lighting configured. Adding data layers...");

    // 1. Add park_lots (Green spaces)
    map.addSource('park-lots-source', { 
        type: 'geojson', 
        data: '../data/park_lots.geojson'
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

    // 2.1. Add Asthma Index Rates
    map.addSource('asthma-index-source', { 
        type: 'geojson', 
        data: '../data/Asthma_Index_Rates.geojson' 
    });
    
    map.addLayer({
        'id': 'asthma-index-layer',
        'type': 'fill',
        'source': 'asthma-index-source',
        'paint': {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'Asthma_Index_Rate'], 0],
                0, 'rgba(0,0,0,0)',
                50, '#FFEDA0',
                100, '#FED976',
                150, '#FEB24C',
                200, '#FD8D3C',
                250, '#FC4E2A',
                300, '#E31A1C',
                350, '#BD0026',
                400, '#800026'
            ],
            'fill-opacity': 0.7,
            'fill-outline-color': '#333'
        }
    }, 'park-lots-layer');

    // 3. Add Freight Routes
    map.addSource('freight-routes-source', {
        type: 'geojson',
        data: '../data/Freight_Routes.geojson'
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
    }, 'asthma-index-layer');

    // 3.1. Add Asthma Hexagonal Data
    map.addSource('asthma-hex-source', {
        type: 'geojson',
        data: '../data/Asthma_Hotspots_Hexagons.geojson' 
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
        data: '../data/zones_fr.geojson'
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
        data: '../data/Traffic_Hotspots.geojson'
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
        data: '../data/Junction_hotspots.geojson'  // Note: Case-sensitive filename
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
        data: '../data/Vulnerability_facilities.geojson'  // Updated filename
    });

    map.addLayer({
        'id': 'vulnerable-facilities-layer',
        'type': 'circle',
        'source': 'vulnerable-facilities-source',
        'paint': {
            'circle-radius': 5,
            'circle-color': [
                'match',
                ['get', 'f_type'],
                'Hospital', '#ff1100',      // Red for hospitals
                'School', '#333333',       // Blue for schools  
                'Day Care', '#404040',      // Green for daycare
                '#FFFFFF'                  // Default white for other types
            ],
            'circle-stroke-width': 0,
            'circle-stroke-color': '#000000',
            'circle-opacity': 1,
            'circle-blur': 1
        }
    }, 'traffic-hotspots-layer');

    // 6. Add Residential Areas
    map.addSource('residential-source', {
        type: 'geojson',
        data: '../data/residential.geojson'
    });

    map.addLayer({
        'id': 'residential-layer',
        'type': 'fill',
        'source': 'residential-source',
        'paint': {
            'fill-color': '#FBDBD9',
            'fill-opacity': 0.0001,
            'fill-outline-color': 'transparent'
        }
    }, 'traffic-hotspots-layer');

    // 7. Add CVI 3D Extrusion Layer with data filtering
    // Using absolute path from repository root for GitHub Pages
    fetch('/data/CVI_hex.geojson')
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
    })
    .catch(error => {
        console.error('Error loading CVI data:', error);
    });

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

    // Initialize scrollytelling after a short delay to ensure all layers are loaded
    setTimeout(() => {
        initScrollytelling();
    }, 500);
});

// Scrollytelling configuration
const storySteps = {
    // Step 1.0: Scroll 1 Intro - Full NYC view with all pollution layers visible
    0: {
        center: [-74.0060, 40.7128], // Approximate center of NYC
        zoom: 9,
        layers: [
            ['park-lots-layer', 'visible', 1.0], // Parks (Full opacity)
            ['asthma-index-layer', 'visible', 0.7], // Asthma (Choropleth)
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['freight-routes-layer', 'visible', 0.8], // Freight Routes (Red Lines)
            ['freight-zones-layer', 'visible', 0.7], // Freight Zones (Orange Lines)
            ['traffic-hotspots-layer', 'visible', 0.8], // Traffic Hotspots (Heatmap)
            ['junction-hotspots-layer', 'visible', 0.8], // Idling Hotspots (Heatmap)
            ['vulnerable-facilities-layer', 'visible', 1.0], // Facilities (White Dots)
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
            ['vulnerable-facilities-layer', 'visible', 1.0],
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
            ['asthma-index-layer', 'visible', 0.7],
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
            ['freight-routes-layer', 'visible', 0.8],
            ['freight-zones-layer', 'visible', 0.7],
            ['traffic-hotspots-layer', 'visible', 0.8],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 1.0],
            ['residential-layer', 'visible', 0.6], // Show residential areas
            ['cvi-3d-extrusion', 'none', 0] // CVI 3D (Hidden)
        ]
    },
    4: { // Freight Routes Only - Show only freight routes and zones
        center: [-73.88, 40.85], // Center on South Bronx
        zoom: 12.5,
        layers: [
            ['park-lots-layer', 'none', 0],
            ['asthma-index-layer', 'none', 0],
            ['asthma-hex-fill', 'none', 0], // Asthma Hex (Hidden)
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
    7: { // CVI 3D Extrusion - Show CVI 3D layer with dramatic perspective
        center: [-73.88, 40.85], // Center on South Bronx for high CVI areas
        zoom: 12,
        pitch: 45, // Add 3D perspective
        bearing: 0,
        layers: [
            ['park-lots-layer', 'visible', 0.3], // Parks faded
            ['asthma-index-layer', 'none', 0], // Hide other layers
            ['asthma-hex-fill', 'none', 0],
            ['freight-routes-layer', 'visible', 0.2], // Freight very faded
            ['freight-zones-layer', 'none', 0],
            ['traffic-hotspots-layer', 'none', 0],
            ['junction-hotspots-layer', 'none', 0],
            ['vulnerable-facilities-layer', 'visible', 0.4], // Facilities visible but faded
            ['residential-layer', 'visible', 0.1], // Residential very faded
            ['cvi-3d-extrusion', 'visible', 0.9] // CVI 3D prominent
        ]
    },
};

// Initialize scrollytelling
function initScrollytelling() {
    console.log('Initializing Scrollama...');
    
    try {
        // Check if scrollama is available
        if (typeof scrollama === 'undefined') {
            throw new Error('Scrollama not loaded. Check if the script is properly included.');
        }

        const steps = document.querySelectorAll('.step');
        console.log('Found', steps.length, 'step elements');
        
        if (steps.length === 0) {
            throw new Error('No .step elements found in the document');
        }

        // Scrollama event handlers
        function handleStepEnter(response) {
            // Hide previous layers when scrolling to a new one
            if (map.getLayer('asthma-hex-fill')) {
                map.setLayoutProperty('asthma-hex-fill', 'visibility', 'none');
            }
            if (map.getLayer('cvi-3d-extrusion')) {
                map.setLayoutProperty('cvi-3d-extrusion', 'visibility', 'none');
            }

            console.log('Entering step:', response.index, response.element.id);
            const stepIndex = response.element.getAttribute('data-step');
            
            if (!stepIndex) {
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
            }
            
            // Update map state
            updateMap(stepIndex);
        }

        const scroller = scrollama();
        
        scroller
            .setup({
                step: '.step',
                offset: 0.5,
                progress: false,
                debug: true, // Enable debug for now
                once: false
            })
            .onStepEnter(handleStepEnter)
            .onStepExit(response => {
                console.log('Exiting step:', response.index);
            });

        // Handle window resize
        function handleResize() {
            console.log('Handling resize...');
            scroller.resize();
        }

        // Add resize event listener
        window.addEventListener('resize', handleResize);
        
        // Set initial state
        console.log('Setting initial state...');
        updateMap('0');
        const firstStep = document.querySelector('.step');
        if (firstStep) {
            firstStep.classList.add('is-active');
        }
        
        // Force resize to ensure proper calculation
        setTimeout(() => {
            scroller.resize();
            console.log('Scrollama initialized successfully');
            
            
            
        }, 100);
        
    } catch (error) {
        console.error('Error initializing Scrollama:', error);
    }
}

// Update map based on current step
function updateMap(stepIndex) {
    const stepData = storySteps[stepIndex];
    if (!stepData) {
        console.warn('No step data for index:', stepIndex);
        return;
    }

    console.log('Updating to step:', stepIndex, stepData);

    // Fly to new camera position
    map.flyTo({
        center: stepData.center,
        zoom: stepData.zoom,
        speed: 1.2,
        curve: 1.42,
        essential: true
    });

    // Update layer visibility and opacity
    stepData.layers.forEach(([layerId, visibility, opacity]) => {
        if (map.getLayer(layerId)) {
            // Update visibility
            map.setLayoutProperty(layerId, 'visibility', visibility);

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
                    } catch (error) {
                        console.warn(`Could not set ${opacityProp} for layer ${layerId}:`, error);
                    }
                }
            }
        } else {
            console.warn(`Layer ${layerId} not found in map`);
        }
    });
}
