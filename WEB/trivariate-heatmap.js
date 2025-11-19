const TrivariateHeatmap = () => {
  // Earthy, natural color palette inspired by Feral Atlas aesthetic
  // Using organic, earth-toned colors suitable for environmental mapping
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

  return (
    <div className="w-full h-full bg-stone-100 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-light text-stone-800 mb-3" style={{fontFamily: 'Georgia, serif'}}>
            Trivariate Analysis Heatmap
          </h1>
          <p className="text-lg text-stone-600 font-light">
            Community Vulnerability Index × Asthma Rates × Canopy Coverage
          </p>
          <p className="text-sm text-stone-500 mt-2 italic">
            More-Than-Human Environmental Health Mapping
          </p>
        </div>

        {/* Heatmap Grid */}
        <div className="bg-stone-50 rounded-sm shadow-md p-8 mb-8 border border-stone-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-4 text-left font-light text-stone-700 border-b border-stone-300" style={{fontFamily: 'Georgia, serif'}}>
                    <div className="text-base">CVI Vulnerability &rarr;</div>
                    <div className="text-xs font-normal text-stone-500 mt-1">Asthma + Canopy &darr;</div>
                  </th>
                  {cviLevels.map(cvi => (
                    <th key={cvi} className="p-4 text-center font-light text-stone-700 border-b border-stone-300" style={{fontFamily: 'Georgia, serif'}}>
                      <div className="text-base">{cvi}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combinations.map(combo => (
                  <tr key={combo}>
                    <td className="p-4 font-normal text-sm text-stone-700 border-r border-stone-300">
                      {combo}
                    </td>
                    {cviLevels.map(cvi => {
                      const color = colorMatrix[cvi][combo];
                      const isPriority = isMaxPriority(combo);
                      return (
                        <td key={`${cvi}-${combo}`} className="p-3">
                          <div 
                            className="w-full h-28 rounded-sm flex items-center justify-center transition-all hover:scale-105 relative group"
                            style={{
                              backgroundColor: color,
                              border: isPriority ? '3px solid #8B4513' : '1px solid rgba(120, 113, 108, 0.2)',
                              boxShadow: isPriority 
                                ? '0 0 16px rgba(139, 69, 19, 0.4)' 
                                : '0 1px 3px rgba(0,0,0,0.08)'
                            }}
                          >
                            <span className="text-xs font-mono text-white opacity-0 group-hover:opacity-90 transition-opacity bg-black bg-opacity-60 px-2 py-1 rounded">
                              {color}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-stone-50 rounded-sm shadow-md p-8 border border-stone-200">
          <h2 className="text-2xl font-light text-stone-800 mb-6" style={{fontFamily: 'Georgia, serif'}}>
            Legend & Interpretation
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="border-l-4 border-stone-600 pl-4">
              <h3 className="font-normal text-stone-800 mb-2" style={{fontFamily: 'Georgia, serif'}}>
                High CVI Vulnerability
              </h3>
              <div className="h-6 rounded-sm mb-2" style={{
                background: 'linear-gradient(to right, #5C1A1A, #8B3A3A, #664B3C, #8B7355)'
              }}></div>
              <p className="text-sm text-stone-600 leading-relaxed">
                Rust to brown gradient — communities with highest social vulnerability and environmental burden
              </p>
            </div>
            
            <div className="border-l-4 border-amber-700 pl-4">
              <h3 className="font-normal text-stone-800 mb-2" style={{fontFamily: 'Georgia, serif'}}>
                Medium CVI Vulnerability
              </h3>
              <div className="h-6 rounded-sm mb-2" style={{
                background: 'linear-gradient(to right, #8B6914, #B8860B, #C2A756, #D4AF6A)'
              }}></div>
              <p className="text-sm text-stone-600 leading-relaxed">
                Ochre to wheat gradient — moderate social vulnerability with varied environmental conditions
              </p>
            </div>
            
            <div className="border-l-4 border-emerald-700 pl-4">
              <h3 className="font-normal text-stone-800 mb-2" style={{fontFamily: 'Georgia, serif'}}>
                Low CVI Vulnerability
              </h3>
              <div className="h-6 rounded-sm mb-2" style={{
                background: 'linear-gradient(to right, #2F5233, #4A7C59, #5A8F7B, #7DB09B)'
              }}></div>
              <p className="text-sm text-stone-600 leading-relaxed">
                Forest to mint gradient — lowest social vulnerability with healthier environmental indicators
              </p>
            </div>
          </div>

          <div className="border-t border-stone-300 pt-6 mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 border-3 rounded-sm flex-shrink-0 mt-1" style={{
                border: '3px solid #8B4513'
              }}></div>
              <div>
                <span className="font-normal text-stone-800">Max Priority Areas</span>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  Brown outline indicates High Asthma (&gt;200 per 10,000) + Low Canopy (&le;5%) — 
                  areas requiring immediate ecological and health intervention
                </p>
              </div>
            </div>

            <div className="bg-stone-100 rounded-sm p-4 mt-4">
              <p className="text-sm text-stone-700 leading-relaxed mb-2">
                <strong className="font-normal">Reading the map:</strong> Darker earth tones indicate higher asthma rates combined with lower tree canopy coverage. 
                The optimal condition (mint green, lower-right) represents communities with low vulnerability, low asthma rates, and high tree canopy coverage.
              </p>
              <p className="text-sm text-stone-600 leading-relaxed italic">
                This visualization maps the entanglement of social vulnerability, respiratory health, and urban ecology — 
                revealing how human infrastructure and more-than-human nature co-constitute community wellbeing.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-stone-500 italic">
          Inspired by Feral Atlas: The More-Than-Human Anthropocene
        </div>
      </div>
    </div>
  );
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('trivariate-heatmap');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(TrivariateHeatmap));
  }
});

// Expose component to window for external access
window.TriariateHeatmap = TrivariateHeatmap;
