import { useState, useEffect } from 'react';

export default function ConcordiaDemo() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [decisionsMade, setDecisionsMade] = useState(0);
  const [selectedProvision, setSelectedProvision] = useState(null);
  const [viewMode, setViewMode] = useState('original');
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const colors = {
    bg: '#1e2228',
    bgLight: '#262b33',
    bgLighter: '#2d333b',
    sidebar: '#252a31',
    border: '#3d444d',
    text: '#e6edf3',
    textMuted: '#7d8590',
    cyan: '#5BA4B5',
    cyanDark: '#4a8a99',
    amber: '#d4a72c',
    red: '#f85149',
    green: '#3fb950',
    white: '#ffffff',
    docBg: '#ffffff',
    docText: '#1a1a1a'
  };

  // Provisions now aligned with actual document sections
  const provisions = [
    { id: 1, name: 'Definition of Confidential Information', status: 'standard', decision: null, section: 1 },
    { id: 2, name: 'Standard of Care', status: 'standard', decision: null, section: 2 },
    { id: 3, name: 'Term and Duration', status: 'review', decision: null, section: 3 },
    { id: 4, name: 'Residuals Clause', status: 'review', decision: null, section: 4 },
    { id: 5, name: 'Return or Destruction', status: 'gap', decision: null, section: 5 },
    { id: 6, name: 'Permitted Disclosures', status: 'standard', decision: null, section: 6 },
    { id: 7, name: 'Representatives Definition', status: 'gap', decision: null, section: 7 },
    { id: 8, name: 'Governing Law', status: 'standard', decision: null, section: 8 },
  ];

  const [provisionState, setProvisionState] = useState(provisions);

  useEffect(() => {
    const decided = provisionState.filter(p => p.decision !== null).length;
    setDecisionsMade(decided);
  }, [provisionState]);

  const handleDecision = (id, decision) => {
    setProvisionState(prev => prev.map(p => 
      p.id === id ? { ...p, decision } : p
    ));
  };

  const nextScreen = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentScreen(prev => prev + 1);
      setIsAnimating(false);
    }, 300);
  };

  const resetDemo = () => {
    setCurrentScreen(0);
    setDecisionsMade(0);
    setSelectedProvision(null);
    setViewMode('original');
    setShowExportSuccess(false);
    setProvisionState(provisions);
  };

  // Tri-bars loader component (The Gradus)
  const TribarsLoader = ({ size = 24, animated = true }) => (
    <div style={{ display: 'flex', gap: size * 0.15, alignItems: 'center', height: size }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: size * 0.2,
            height: size * (0.5 + i * 0.2),
            backgroundColor: colors.cyan,
            borderRadius: 2,
            opacity: animated ? undefined : 0.8,
            animation: animated ? `tribarPulse 1s ease-in-out ${i * 0.15}s infinite` : 'none'
          }}
        />
      ))}
    </div>
  );

  // Status indicator
  const StatusIndicator = ({ status = 'connected' }) => {
    const statusColors = {
      connected: colors.cyan,
      processing: colors.amber,
      error: colors.red
    };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: statusColors[status],
          boxShadow: `0 0 8px ${statusColors[status]}`,
          animation: status === 'processing' ? 'pulse 1s infinite' : 'none'
        }} />
        <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {status}
        </span>
      </div>
    );
  };

  // Reusable Header component
  const Header = ({ processing = false }) => (
    <div style={{
      height: 48,
      backgroundColor: colors.bgLight,
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <TribarsLoader size={20} animated={processing} />
        <span style={{ 
          fontFamily: "'Josefin Sans', sans-serif",
          fontSize: 13,
          letterSpacing: '0.3em',
          color: colors.text
        }}>
          NDA+ <span style={{ color: colors.textMuted }}>|</span> CONCORDIA
        </span>
      </div>
      <StatusIndicator status={processing ? "processing" : "connected"} />
    </div>
  );

  // Document section component with proper highlighting
  const DocumentSection = ({ sectionNum, title, content, highlightType = null }) => {
    const isHighlighted = selectedProvision && 
      provisionState.find(p => p.id === selectedProvision)?.section === sectionNum;
    
    const provision = provisionState.find(p => p.section === sectionNum);
    const statusColor = provision?.status === 'review' ? colors.amber : 
                        provision?.status === 'gap' ? colors.red : 'transparent';
    
    return (
      <p style={{ 
        marginBottom: 14, 
        backgroundColor: isHighlighted ? (
          provision?.status === 'review' ? 'rgba(212, 167, 44, 0.15)' :
          provision?.status === 'gap' ? 'rgba(248, 81, 73, 0.15)' :
          'rgba(91, 164, 181, 0.1)'
        ) : 'transparent',
        padding: isHighlighted ? '8px 10px' : 0,
        borderLeft: isHighlighted ? `3px solid ${statusColor !== 'transparent' ? statusColor : colors.cyan}` : 'none',
        borderRadius: isHighlighted ? '0 4px 4px 0' : 0,
        transition: 'all 0.2s ease'
      }}>
        <strong>{sectionNum}. {title}.</strong> {content}
      </p>
    );
  };

  // Screen 0: Splash
  const SplashScreen = () => (
    <div 
      onClick={nextScreen}
      style={{
        height: '100vh',
        backgroundColor: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }}
    >
      <TribarsLoader size={48} />
      <div style={{ 
        marginTop: 32, 
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize: 14,
        letterSpacing: '0.4em',
        color: colors.textMuted
      }}>
        NDA+ | CONCORDIA
      </div>
      <div style={{
        position: 'absolute',
        bottom: 40,
        fontSize: 12,
        color: colors.textMuted,
        opacity: 0.6
      }}>
        Click anywhere to continue
      </div>
    </div>
  );

  // Screen 1: Empty State
  const EmptyState = () => (
    <div style={{ height: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ 
          flex: 1, 
          backgroundColor: colors.bgLighter,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          borderRight: `1px solid ${colors.border}`
        }}>
          <div style={{
            width: 64,
            height: 80,
            border: `2px dashed ${colors.border}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <span style={{ fontSize: 24, color: colors.textMuted }}>+</span>
          </div>
          <div style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>
            No document loaded
          </div>
          <button
            onClick={nextScreen}
            style={{
              padding: '12px 32px',
              backgroundColor: colors.cyan,
              color: colors.white,
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.05em'
            }}
          >
            Load Document
          </button>
        </div>
        <div style={{ 
          width: 320, 
          backgroundColor: colors.sidebar,
          padding: 20
        }}>
          <div style={{ 
            fontSize: 11, 
            color: colors.textMuted, 
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 16
          }}>
            Analysis Results
          </div>
          <div style={{
            height: 200,
            border: `1px dashed ${colors.border}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textMuted,
            fontSize: 13
          }}>
            Awaiting document...
          </div>
        </div>
      </div>
    </div>
  );

  // Screen 2: Document Loaded
  const DocumentLoaded = () => (
    <div style={{ height: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ 
          flex: 1, 
          backgroundColor: colors.bgLighter,
          padding: 24,
          borderRight: `1px solid ${colors.border}`,
          overflow: 'auto'
        }}>
          <div style={{
            backgroundColor: colors.docBg,
            borderRadius: 4,
            padding: 32,
            minHeight: 400,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ color: colors.docText, fontFamily: 'Times New Roman, serif', fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <strong style={{ fontSize: 16 }}>MUTUAL NON-DISCLOSURE AGREEMENT</strong>
              </div>
              <p style={{ marginBottom: 12 }}>
                This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of December 1, 2025 
                ("Effective Date"), by and between Acme Corporation, a Delaware corporation ("Acme"), 
                and Beta Industries LLC, a California limited liability company ("Beta").
              </p>
              <p style={{ marginBottom: 12 }}>
                <strong>1. Definition of Confidential Information.</strong> "Confidential Information" means 
                any information disclosed by either party to the other party, either directly or indirectly, 
                in writing, orally, or by inspection of tangible objects...
              </p>
              <p style={{ marginBottom: 12, color: '#666' }}>
                [Document continues for 12 pages...]
              </p>
            </div>
          </div>
        </div>
        <div style={{ 
          width: 320, 
          backgroundColor: colors.sidebar,
          padding: 20,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            fontSize: 11, 
            color: colors.textMuted, 
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 8
          }}>
            Document Loaded
          </div>
          <div style={{ 
            fontSize: 13, 
            color: colors.text, 
            marginBottom: 24,
            padding: 12,
            backgroundColor: colors.bgLighter,
            borderRadius: 4
          }}>
            Acme_Beta_NDA_2025.docx
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              12 pages • 47 provisions detected
            </div>
          </div>
          <button
            onClick={nextScreen}
            style={{
              padding: '14px 24px',
              backgroundColor: colors.cyan,
              color: colors.white,
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.05em'
            }}
          >
            Analyze Document
          </button>
        </div>
      </div>
    </div>
  );

  // Screen 3: Analyzing
  const AnalyzingScreen = () => {
    useEffect(() => {
      const timer = setTimeout(nextScreen, 2500);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div style={{ height: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
        <Header processing={true} />
        <div style={{ flex: 1, display: 'flex' }}>
          <div style={{ 
            flex: 1, 
            backgroundColor: colors.bgLighter,
            padding: 24,
            borderRight: `1px solid ${colors.border}`,
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, transparent, ${colors.cyan}, transparent)`,
              animation: 'scan 2s ease-in-out infinite'
            }} />
            <div style={{
              backgroundColor: colors.docBg,
              borderRadius: 4,
              padding: 32,
              minHeight: 400,
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              opacity: 0.7
            }}>
              <div style={{ color: colors.docText, fontFamily: 'Times New Roman, serif', fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <strong style={{ fontSize: 16 }}>MUTUAL NON-DISCLOSURE AGREEMENT</strong>
                </div>
                <p style={{ marginBottom: 12, backgroundColor: 'rgba(91, 164, 181, 0.2)', padding: 4 }}>
                  This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of December 1, 2025...
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong>1. Definition of Confidential Information.</strong> "Confidential Information" means 
                  any information disclosed by either party...
                </p>
              </div>
            </div>
          </div>
          <div style={{ 
            width: 320, 
            backgroundColor: colors.sidebar,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TribarsLoader size={40} />
            <div style={{ 
              marginTop: 24,
              fontSize: 13, 
              color: colors.text,
              textAlign: 'center'
            }}>
              Analyzing document...
            </div>
            <div style={{ 
              marginTop: 8,
              fontSize: 11, 
              color: colors.textMuted,
              textAlign: 'center'
            }}>
              Applying 43 benchmark provisions
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Screen 4: Results - with proper document-provision alignment
  const ResultsScreen = () => (
    <div style={{ height: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Document Pane with aligned provisions */}
        <div style={{ 
          flex: 1, 
          backgroundColor: colors.bgLighter,
          padding: 24,
          borderRight: `1px solid ${colors.border}`,
          overflow: 'auto'
        }}>
          <div style={{
            backgroundColor: colors.docBg,
            borderRadius: 4,
            padding: 32,
            minHeight: 400,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ color: colors.docText, fontFamily: 'Times New Roman, serif', fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <strong style={{ fontSize: 16 }}>MUTUAL NON-DISCLOSURE AGREEMENT</strong>
              </div>
              
              <DocumentSection 
                sectionNum={1}
                title="Definition of Confidential Information"
                content={`"Confidential Information" means any information disclosed by either party to the other party, either directly or indirectly, in writing, orally, or by inspection of tangible objects, including without limitation technical data, trade secrets, know-how, research, product plans, and financial information...`}
              />
              
              <DocumentSection 
                sectionNum={2}
                title="Standard of Care"
                content="The Receiving Party shall protect Confidential Information using the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care..."
              />
              
              <DocumentSection 
                sectionNum={3}
                title="Term and Duration"
                content="This Agreement shall remain in effect for a period of three (3) years from the Effective Date. The obligations of confidentiality shall survive for a period of five (5) years following any disclosure of Confidential Information..."
              />
              
              <DocumentSection 
                sectionNum={4}
                title="Residuals"
                content="Nothing in this Agreement shall restrict the Receiving Party from using Residual Information. 'Residual Information' means information retained in the unaided memories of the Receiving Party's personnel who have had access to Confidential Information..."
              />
              
              <DocumentSection 
                sectionNum={5}
                title="Return of Materials"
                content="[NO PROVISION FOUND — Gap identified. Standard return/destruction language absent from agreement.]"
              />
              
              <DocumentSection 
                sectionNum={6}
                title="Permitted Disclosures"
                content="The Receiving Party may disclose Confidential Information to the extent required by law, provided that it gives the Disclosing Party prompt written notice of such requirement and cooperates with efforts to obtain a protective order..."
              />
              
              <DocumentSection 
                sectionNum={7}
                title="Representatives"
                content="[UNDEFINED — The term 'Representatives' is used but not defined. No limitation on scope of permitted recipients.]"
              />
              
              <DocumentSection 
                sectionNum={8}
                title="Governing Law"
                content="This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without giving effect to any choice of law principles..."
              />

              <p style={{ marginTop: 16, color: '#888', fontSize: 12, fontStyle: 'italic' }}>
                [Click provisions in sidebar to highlight corresponding sections]
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ 
          width: 360, 
          backgroundColor: colors.sidebar,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Summary */}
          <div style={{ padding: 16, borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <span style={{ fontSize: 11, color: colors.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Analysis Complete
              </span>
              <span style={{ fontSize: 11, color: colors.cyan }}>
                Decisions: {decisionsMade} of {provisionState.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ 
                flex: 1, 
                padding: 12, 
                backgroundColor: colors.bgLighter, 
                borderRadius: 4,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, color: colors.green, fontWeight: 600 }}>4</div>
                <div style={{ fontSize: 10, color: colors.textMuted }}>Standard</div>
              </div>
              <div style={{ 
                flex: 1, 
                padding: 12, 
                backgroundColor: colors.bgLighter, 
                borderRadius: 4,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, color: colors.amber, fontWeight: 600 }}>2</div>
                <div style={{ fontSize: 10, color: colors.textMuted }}>Review</div>
              </div>
              <div style={{ 
                flex: 1, 
                padding: 12, 
                backgroundColor: colors.bgLighter, 
                borderRadius: 4,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, color: colors.red, fontWeight: 600 }}>2</div>
                <div style={{ fontSize: 10, color: colors.textMuted }}>Gaps</div>
              </div>
            </div>
          </div>

          {/* Provisions List */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {provisionState.map(provision => (
              <div
                key={provision.id}
                onClick={() => setSelectedProvision(selectedProvision === provision.id ? null : provision.id)}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  backgroundColor: selectedProvision === provision.id ? colors.bgLighter : 'transparent',
                  borderRadius: 4,
                  border: `1px solid ${selectedProvision === provision.id ? colors.cyan : colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: provision.status === 'standard' ? colors.green : 
                                    provision.status === 'review' ? colors.amber : colors.red
                  }} />
                  <span style={{ fontSize: 12, color: colors.text, flex: 1 }}>
                    {provision.name}
                  </span>
                  {provision.decision && (
                    <span style={{ 
                      fontSize: 9, 
                      color: colors.green, 
                      backgroundColor: 'rgba(63, 185, 80, 0.2)',
                      padding: '2px 6px',
                      borderRadius: 3
                    }}>
                      {provision.decision}
                    </span>
                  )}
                </div>
                
                {/* Section number indicator */}
                <div style={{ 
                  fontSize: 10, 
                  color: colors.textMuted, 
                  marginLeft: 16,
                  marginBottom: selectedProvision === provision.id ? 8 : 0
                }}>
                  Section {provision.section}
                </div>
                
                {selectedProvision === provision.id && !provision.decision && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {['Accept', 'Modify', 'Flag'].map(action => (
                      <button
                        key={action}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDecision(provision.id, action);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 10,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 3,
                          backgroundColor: 'transparent',
                          color: colors.text,
                          cursor: 'pointer'
                        }}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
            <button
              onClick={nextScreen}
              style={{
                width: '100%',
                padding: '12px 24px',
                backgroundColor: colors.cyan,
                color: colors.white,
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                letterSpacing: '0.05em'
              }}
            >
              Apply Decisions
            </button>
            <div style={{ 
              fontSize: 10, 
              color: colors.textMuted, 
              textAlign: 'center',
              marginTop: 8
            }}>
              Click provisions to review and decide
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Screen 5: Applying
  const ApplyingScreen = () => {
    useEffect(() => {
      const timer = setTimeout(nextScreen, 2000);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div style={{ height: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
        <Header processing={true} />
        <div style={{ 
          flex: 1, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <TribarsLoader size={48} />
          <div style={{ 
            marginTop: 24,
            fontSize: 15, 
            color: colors.text
          }}>
            Applying decisions...
          </div>
          <div style={{ 
            marginTop: 8,
            fontSize: 12, 
            color: colors.textMuted
          }}>
            Generating modified document
          </div>
        </div>
      </div>
    );
  };

  // Screen 6: Complete - with lender-appropriate modifications
  const CompleteScreen = () => (
    <div style={{ height: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Document Pane */}
        <div style={{ 
          flex: 1, 
          backgroundColor: colors.bgLighter,
          padding: 24,
          borderRight: `1px solid ${colors.border}`,
          overflow: 'auto'
        }}>
          {/* View Toggle */}
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            marginBottom: 16,
            backgroundColor: colors.bg,
            padding: 4,
            borderRadius: 6,
            width: 'fit-content'
          }}>
            {['original', 'modified'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 16px',
                  fontSize: 11,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: viewMode === mode ? colors.cyan : 'transparent',
                  color: viewMode === mode ? colors.white : colors.textMuted,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{
            backgroundColor: colors.docBg,
            borderRadius: 4,
            padding: 32,
            minHeight: 400,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ color: colors.docText, fontFamily: 'Times New Roman, serif', fontSize: 14, lineHeight: 1.8 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <strong style={{ fontSize: 16 }}>MUTUAL NON-DISCLOSURE AGREEMENT</strong>
                {viewMode === 'modified' && (
                  <div style={{ fontSize: 10, color: colors.cyan, marginTop: 4 }}>
                    [Modified Version — Concordia Review]
                  </div>
                )}
              </div>
              
              {viewMode === 'modified' ? (
                <>
                  <p style={{ marginBottom: 14 }}>
                    <strong>1. Definition of Confidential Information.</strong> "Confidential Information" means 
                    any information disclosed by either party to the other party...
                  </p>
                  
                  <p style={{ marginBottom: 14 }}>
                    <strong>2. Standard of Care.</strong> The Receiving Party shall protect Confidential Information 
                    using the same degree of care it uses to protect its own confidential information...
                  </p>
                  
                  <p style={{ marginBottom: 14 }}>
                    <strong>3. Term and Duration.</strong> This Agreement shall remain in effect for a period of 
                    three (3) years from the Effective Date...
                  </p>
                  
                  <p style={{ 
                    marginBottom: 14, 
                    backgroundColor: 'rgba(212, 167, 44, 0.15)',
                    padding: '8px 10px',
                    borderLeft: `3px solid ${colors.amber}`,
                    borderRadius: '0 4px 4px 0'
                  }}>
                    <strong style={{ color: '#8a6d1b' }}>[MODIFIED]</strong> <strong>4. Residuals.</strong> Nothing 
                    in this Agreement shall restrict the Receiving Party from using Residual Information; 
                    <em style={{ color: colors.amber }}> provided, however, that Residual Information shall not 
                    include any information that is reduced to tangible form or incorporated into any work product</em>.
                  </p>
                  
                  <p style={{ 
                    marginBottom: 14, 
                    backgroundColor: 'rgba(63, 185, 80, 0.1)',
                    padding: '8px 10px',
                    borderLeft: `3px solid ${colors.green}`,
                    borderRadius: '0 4px 4px 0'
                  }}>
                    <strong style={{ color: colors.green }}>[ADDED]</strong> <strong>5. Return or Destruction of Materials.</strong> Upon 
                    termination of this Agreement or upon written request by the Disclosing Party, the Receiving Party 
                    shall promptly return or destroy all Confidential Information and all copies thereof, and shall 
                    certify such return or destruction in writing within ten (10) business days.
                  </p>
                  
                  <p style={{ marginBottom: 14 }}>
                    <strong>6. Permitted Disclosures.</strong> The Receiving Party may disclose Confidential Information 
                    to the extent required by law...
                  </p>
                  
                  <p style={{ 
                    marginBottom: 14, 
                    backgroundColor: 'rgba(63, 185, 80, 0.1)',
                    padding: '8px 10px',
                    borderLeft: `3px solid ${colors.green}`,
                    borderRadius: '0 4px 4px 0'
                  }}>
                    <strong style={{ color: colors.green }}>[ADDED]</strong> <strong>7. Representatives.</strong> "Representatives" 
                    means the Receiving Party's directors, officers, employees, attorneys, accountants, and financial 
                    advisors who (a) have a need to know such Confidential Information for the Purpose, and (b) are 
                    bound by confidentiality obligations no less protective than those contained herein.
                  </p>
                  
                  <p style={{ marginBottom: 14 }}>
                    <strong>8. Governing Law.</strong> This Agreement shall be governed by and construed in accordance 
                    with the laws of the State of Delaware...
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: 14 }}>
                    <strong>1. Definition of Confidential Information.</strong> "Confidential Information" means 
                    any information disclosed by either party to the other party, either directly or indirectly, 
                    in writing, orally, or by inspection of tangible objects...
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <strong>2. Standard of Care.</strong> The Receiving Party shall protect Confidential Information 
                    using the same degree of care it uses to protect its own confidential information...
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <strong>3. Term and Duration.</strong> This Agreement shall remain in effect for a period of 
                    three (3) years from the Effective Date...
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <strong>4. Residuals.</strong> Nothing in this Agreement shall restrict the Receiving Party 
                    from using Residual Information...
                  </p>
                  <p style={{ marginBottom: 14, color: '#999', fontStyle: 'italic' }}>
                    [Section 5 — Return of Materials: NOT PRESENT]
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <strong>6. Permitted Disclosures.</strong> The Receiving Party may disclose Confidential Information 
                    to the extent required by law...
                  </p>
                  <p style={{ marginBottom: 14, color: '#999', fontStyle: 'italic' }}>
                    [Section 7 — Representatives Definition: NOT PRESENT]
                  </p>
                  <p style={{ marginBottom: 14 }}>
                    <strong>8. Governing Law.</strong> This Agreement shall be governed by and construed in accordance 
                    with the laws of the State of Delaware...
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ 
          width: 320, 
          backgroundColor: colors.sidebar,
          padding: 20,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: 16, 
            backgroundColor: 'rgba(63, 185, 80, 0.1)', 
            borderRadius: 8,
            border: `1px solid ${colors.green}`,
            marginBottom: 24
          }}>
            <div style={{ 
              fontSize: 14, 
              color: colors.green, 
              fontWeight: 500,
              marginBottom: 4
            }}>
              ✓ Decisions Applied
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              {decisionsMade || 4} modifications made
            </div>
          </div>

          <div style={{ 
            fontSize: 11, 
            color: colors.textMuted, 
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 12
          }}>
            Changes Summary
          </div>
          
          <div style={{ fontSize: 12, color: colors.text, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: colors.amber }}>●</span>
              <span>1 provision modified</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: colors.green }}>●</span>
              <span>2 provisions added</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: colors.textMuted }}>●</span>
              <span>5 provisions unchanged</span>
            </div>
          </div>

          <button
            onClick={() => {
              setShowExportSuccess(true);
              setTimeout(() => nextScreen(), 1500);
            }}
            style={{
              padding: '14px 24px',
              backgroundColor: colors.cyan,
              color: colors.white,
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.05em',
              marginBottom: 12
            }}
          >
            Export to Word
          </button>

          {showExportSuccess && (
            <div style={{ 
              padding: 12, 
              backgroundColor: 'rgba(63, 185, 80, 0.1)', 
              borderRadius: 4,
              textAlign: 'center',
              color: colors.green,
              fontSize: 12
            }}>
              ✓ Acme_Beta_NDA_concordia_modified.docx saved
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={resetDemo}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Restart Demo
          </button>
        </div>
      </div>
    </div>
  );

  // Final screen
  const FinalScreen = () => (
    <div style={{
      height: '100vh',
      backgroundColor: colors.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: 40
    }}>
      <TribarsLoader size={40} animated={false} />
      <h2 style={{ 
        fontFamily: "'Archivo', sans-serif",
        fontSize: 28,
        fontWeight: 300,
        color: colors.text,
        marginTop: 32,
        marginBottom: 16,
        letterSpacing: '0.05em'
      }}>
        Real expertise. Unreal intelligence.
      </h2>
      <p style={{ 
        fontSize: 14, 
        color: colors.textMuted,
        maxWidth: 400,
        lineHeight: 1.7,
        marginBottom: 32
      }}>
        Concordia transforms document review from hours to minutes. 
        Precision analysis. Institutional benchmarks. Seamless workflow.
      </p>
      <div style={{ display: 'flex', gap: 16 }}>
        <button
          onClick={resetDemo}
          style={{
            padding: '12px 32px',
            backgroundColor: 'transparent',
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: '0.05em'
          }}
        >
          Replay Demo
        </button>
        <button
          style={{
            padding: '12px 32px',
            backgroundColor: colors.cyan,
            color: colors.white,
            border: 'none',
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: '0.05em'
          }}
        >
          Request Access
        </button>
      </div>
      <div style={{ 
        position: 'absolute',
        bottom: 32,
        fontSize: 11,
        color: colors.textMuted,
        letterSpacing: '0.2em'
      }}>
        GREY STRATUM
      </div>
    </div>
  );

  const screens = [
    SplashScreen,
    EmptyState,
    DocumentLoaded,
    AnalyzingScreen,
    ResultsScreen,
    ApplyingScreen,
    CompleteScreen,
    FinalScreen
  ];

  const CurrentScreen = screens[Math.min(currentScreen, screens.length - 1)];

  return (
    <div style={{ 
      opacity: isAnimating ? 0 : 1, 
      transition: 'opacity 0.3s ease',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400&family=Inter:wght@300;400;500&family=Archivo:wght@300;400&display=swap');
        
        @keyframes tribarPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(400px); opacity: 0; }
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        button:hover {
          opacity: 0.9;
        }
      `}</style>
      <CurrentScreen />
    </div>
  );
}
