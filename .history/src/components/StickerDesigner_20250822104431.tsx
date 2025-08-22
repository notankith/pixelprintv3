import { useState, useCallback, useRef } from 'react';
import { CanvasEditor, CanvasEditorHandle } from './canvas/CanvasEditor';
import { PropertiesPanel } from './properties/PropertiesPanel';
import { Toolbar } from './toolbar/Toolbar';
import { DesignManager } from './design/DesignManager';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

export interface DesignElement {
  id: string;
  type: 'text' | 'image' | 'date';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  properties: Record<string, any>;
}

export interface Design {
  id?: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: DesignElement[];
  thumbnailUrl?: string;
}

export const StickerDesigner = () => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [currentDesign, setCurrentDesign] = useState<Design>({
    name: 'Untitled Design',
    canvasWidth: 842,  // Landscape: width > height
    canvasHeight: 595,
    elements: []
  });

  const handleElementSelect = useCallback((elementId: string | null) => {
    setSelectedElementId(elementId);
  }, []);

  const handleElementUpdate = useCallback((elementId: string, updates: Partial<DesignElement>) => {
    setCurrentDesign(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      )
    }));
  }, []);

  const handleElementAdd = useCallback((element: DesignElement) => {
    setCurrentDesign(prev => ({
      ...prev,
      elements: [...prev.elements, element]
    }));
  }, []);

  const handleElementDelete = useCallback((elementId: string) => {
    setCurrentDesign(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== elementId)
    }));
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  }, [selectedElementId]);

  const handleDesignLoad = useCallback((design: Design) => {
    setCurrentDesign(design);
    setSelectedElementId(null);
  }, []);

  const editorRef = useRef<CanvasEditorHandle | null>(null);

  const handlePrint = useCallback(async () => {
    if (!editorRef.current) return toast.error('Canvas not ready');
    toast('Preparing print...');
  await editorRef.current.print();
  }, []);

  const handleExport = useCallback(async () => {
    if (!editorRef.current) return toast.error('Canvas not ready');
  await editorRef.current.exportPDF('design.pdf');
  }, []);

  const selectedElement = selectedElementId 
    ? currentDesign.elements.find(el => el.id === selectedElementId)
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">StickerPrint Designer</h1>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground">{currentDesign.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Left Sidebar - Design Manager */}
        <div className="w-64 border-r border-border p-4">
          <DesignManager 
            currentDesign={currentDesign}
            onDesignLoad={handleDesignLoad}
            onDesignSave={setCurrentDesign}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="border-b border-border p-3">
            <Toolbar onElementAdd={handleElementAdd} />
          </div>

          {/* Canvas */}
          <div className="flex-1 p-6 bg-muted/30">
            <CanvasEditor
              design={currentDesign}
              selectedElementId={selectedElementId}
              onElementSelect={handleElementSelect}
              onElementUpdate={handleElementUpdate}
              ref={editorRef}
            />
          </div>
        </div>

        {/* Right Sidebar - Properties Panel */}
        <div className="w-80 border-l border-border p-4">
          <PropertiesPanel 
            selectedElement={selectedElement}
            onElementUpdate={handleElementUpdate}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-2 text-center">
        <button 
          onClick={() => window.open('https://github.com/lovable-dev', '_blank')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          credits
        </button>
      </footer>
    </div>
  );
};