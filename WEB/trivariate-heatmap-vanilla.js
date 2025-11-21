// Vanilla JavaScript implementation of Trivariate Heatmap
function createTrivariateHeatmap() {
  // Earthy, natural color palette inspired by Feral Atlas aesthetic
  const colorMatrix = {
    'High CVI': {
      'High Asthma + Low Canopy': '#5C1A1A',      // Deep rust brown
      'High Asthma + High Canopy': '#8B3A3A',     // Terra cotta
      'Low Asthma + Low Canopy': '#664B3C',       // Earthy brown
      'Low Asthma + High Canopy': '#8B7355'       // Sandy brown
    },
    'Medium CVI': {
      'High Asthma + Low Canopy': '#8B6914',      // Dark goldenrod
      'High Asthma + High Canopy': '#B8860B',     // Golden ochre
      'Low Asthma + Low Canopy': '#C2A756',       // Wheat
      'Low Asthma + High Canopy': '#D4AF6A'       // Pale gold
    },
    'Low CVI': {
      'High Asthma + Low Canopy': '#2F5233',      // Forest green
      'High Asthma + High Canopy': '#4A7C59',     // Sage green
      'Low Asthma + Low Canopy': '#5A8F7B',       // Seafoam
      'Low Asthma + High Canopy': '#7DB09B'       // Mint green (best case)
    }
  };

  const cviLevels = ['High CVI', 'Medium CVI', 'Low CVI'];
  const combinations = [
    'High Asthma + Low Canopy',
    'High Asthma + High Canopy',
    'Low Asthma + Low Canopy',
    'Low Asthma + High Canopy'
  ];

  const isMaxPriority = (combo) => combo === 'High Asthma + Low Canopy';

  // Create the main container with dark background
  const container = document.createElement('div');
  container.className = 'w-full h-full p-8 overflow-auto';
  container.style.backgroundColor = '#333';
  container.style.color = '#fff';
  
  const mainDiv = document.createElement('div');
  mainDiv.className = 'max-w-6xl mx-auto';
  container.appendChild(mainDiv);

  // Header
  const header = document.createElement('div');
  header.className = 'text-center mb-8';
  header.innerHTML = `
    <h1 class="text-4xl font-light mb-3" style="font-family: Arial, sans-serif; color: #fff;">
      Trivariate Analysis Heatmap
    </h1>
    <p class="text-lg font-light" style="color: #ccc;">
      Community Vulnerability Index × Asthma Rates × Canopy Coverage
    </p>
    <p class="text-sm mt-2 italic" style="color: #999;">
      More-Than-Human Environmental Health Mapping
    </p>
  `;
  mainDiv.appendChild(header);

  // Heatmap Grid with dark background
  const heatmapSection = document.createElement('div');
  heatmapSection.style.background = 'rgba(0, 0, 0, 0.8)';
  heatmapSection.style.padding = '2rem';
  heatmapSection.style.borderRadius = '8px';
  heatmapSection.style.marginBottom = '2rem';
  heatmapSection.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  
  const tableContainer = document.createElement('div');
  tableContainer.className = 'overflow-x-auto';
  
  const table = document.createElement('table');
  table.className = 'w-full border-collapse';
  
  // Table header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
    <th class="p-4 text-left font-light border-b" style="color: #ccc; border-color: rgba(255, 255, 255, 0.2); font-weight: 600;">
      <div class="text-base">CVI Vulnerability →</div>
      <div class="text-xs font-normal mt-1" style="color: #999;">Asthma + Canopy ↓</div>
    </th>
  `;
  
  cviLevels.forEach(cvi => {
    const th = document.createElement('th');
    th.className = 'p-4 text-center font-light border-b';
    th.style.color = '#ccc';
    th.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    th.style.fontWeight = '600';
    th.innerHTML = `<div class="text-base">${cvi}</div>`;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Table body
  const tbody = document.createElement('tbody');
  combinations.forEach(combo => {
    const row = document.createElement('tr');
    
    // Row header
    const rowHeader = document.createElement('td');
    rowHeader.className = 'p-4 font-normal text-sm border-r';
    rowHeader.style.color = '#ccc';
    rowHeader.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    rowHeader.textContent = combo;
    row.appendChild(rowHeader);
    
    // Color cells
    cviLevels.forEach(cvi => {
      const cell = document.createElement('td');
      cell.className = 'p-3';
      
      const color = colorMatrix[cvi][combo];
      const isPriority = isMaxPriority(combo);
      
      const colorDiv = document.createElement('div');
      colorDiv.className = 'w-full h-28 rounded-sm flex items-center justify-center transition-all hover:scale-105 relative group';
      colorDiv.style.backgroundColor = color;
      colorDiv.style.border = isPriority ? '3px solid #FF0000' : '1px solid rgba(120, 113, 108, 0.2)';
      colorDiv.style.boxShadow = isPriority ? '0 0 16px rgba(255, 0, 0, 0.4)' : '0 1px 3px rgba(0,0,0,0.08)';
      
      const colorCode = document.createElement('span');
      colorCode.className = 'text-xs font-mono text-white opacity-0 group-hover:opacity-90 transition-opacity bg-black bg-opacity-60 px-2 py-1 rounded';
      colorCode.textContent = color;
      colorDiv.appendChild(colorCode);
      
      cell.appendChild(colorDiv);
      row.appendChild(cell);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
  heatmapSection.appendChild(tableContainer);
  mainDiv.appendChild(heatmapSection);

  // Legend section with dark background matching bivariate legend
  const legendSection = document.createElement('div');
  legendSection.className = 'legend';
  legendSection.style.background = 'rgba(0, 0, 0, 0.8)';
  legendSection.style.padding = '1rem';
  legendSection.style.borderRadius = '8px';
  legendSection.style.marginTop = '1rem';
  legendSection.style.maxWidth = '500px';
  legendSection.style.pointerEvents = 'auto';
  
  const legendTitle = document.createElement('h4');
  legendTitle.style.margin = '0 0 1rem 0';
  legendTitle.style.color = '#fff';
  legendTitle.style.fontSize = '1em';
  legendTitle.style.fontWeight = '600';
  legendTitle.textContent = 'Trivariate Analysis Legend';
  legendSection.appendChild(legendTitle);
  
  // Legend grid
  const legendGrid = document.createElement('div');
  legendGrid.className = 'grid md:grid-cols-3 gap-6 mb-6';
  
  const legendItems = [
    {
      title: 'High CVI Vulnerability',
      border: 'border-stone-600',
      gradient: 'linear-gradient(to right, #5C1A1A, #8B3A3A, #664B3C, #8B7355)',
      description: 'Rust to brown gradient — communities with highest social vulnerability and environmental burden'
    },
    {
      title: 'Medium CVI Vulnerability',
      border: 'border-amber-700',
      gradient: 'linear-gradient(to right, #8B6914, #B8860B, #C2A756, #D4AF6A)',
      description: 'Ochre to wheat gradient — moderate social vulnerability with varied environmental conditions'
    },
    {
      title: 'Low CVI Vulnerability',
      border: 'border-emerald-700',
      gradient: 'linear-gradient(to right, #2F5233, #4A7C59, #5A8F7B, #7DB09B)',
      description: 'Forest to mint gradient — lowest social vulnerability with healthier environmental indicators'
    }
  ];
  
  legendItems.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'legend-item';
    itemDiv.style.marginBottom = '0.5rem';
    itemDiv.style.gap = '0.5rem';
    itemDiv.innerHTML = `
      <div class="legend-color" style="background: ${item.gradient}; height: 20px; width: 20px; border: 1px solid rgba(255, 255, 255, 0.3);"></div>
      <div class="legend-label" style="font-size: 0.9em; line-height: 1.3; color: #ccc;">
        <strong style="color: #fff; font-weight: 600;">${item.title}</strong><br>
        <span style="font-size: 0.8em;">${item.description}</span>
      </div>
    `;
    legendGrid.appendChild(itemDiv);
  });
  
  legendSection.appendChild(legendGrid);
  
  // Max priority section as legend note
  const prioritySection = document.createElement('div');
  prioritySection.className = 'legend-note';
  prioritySection.style.marginTop = '1rem';
  prioritySection.style.paddingTop = '0.5rem';
  prioritySection.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
  prioritySection.style.fontSize = '12px';
  prioritySection.style.lineHeight = '1.4';
  prioritySection.style.color = '#ccc';
  prioritySection.innerHTML = `
    <strong>⚠️ Max Priority Areas:</strong> Bright red outline indicates High Asthma (&gt;200 per 10,000) + Low Canopy (&le;5%) — 
    areas requiring immediate ecological and health intervention. Darker earth tones indicate higher asthma rates combined with lower tree canopy coverage.
  `;
  legendSection.appendChild(prioritySection);
  mainDiv.appendChild(legendSection);
  
  // Footer
  const footer = document.createElement('div');
  footer.className = 'text-center mt-6 text-xs italic';
  footer.style.color = '#999';
  footer.textContent = 'Inspired by Feral Atlas: The More-Than-Human Anthropocene';
  mainDiv.appendChild(footer);

  return container;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('trivariate-heatmap-left');
  if (container) {
    const heatmap = createTrivariateHeatmap();
    container.appendChild(heatmap);
  }
  
  // Show/hide heatmap based on scroll position
  const scroll15Step = document.getElementById('scroll-15-trivariate-solutions');
  const heatmapContainer = document.getElementById('trivariate-heatmap-left');
  
  // Use Intersection Observer to detect when scroll 15 is active
  if (scroll15Step && heatmapContainer) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          heatmapContainer.style.display = 'block';
        } else {
          heatmapContainer.style.display = 'none';
        }
      });
    }, {
      threshold: 0.5 // Show when 50% of the element is visible
    });
    
    observer.observe(scroll15Step);
  }
});

// Expose function for external access
window.createTrivariateHeatmap = createTrivariateHeatmap;
