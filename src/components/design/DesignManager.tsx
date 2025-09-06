import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, FolderOpen, Trash2, Download, RefreshCw } from 'lucide-react';
import { Design } from '../StickerDesigner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateCanvasThumbnail } from '@/utils/canvasUtils';

interface DesignManagerProps {
  currentDesign: Design;
  onDesignLoad: (design: Design) => void;
  onDesignSave: (design: Design) => void;
}

export const DesignManager = ({ 
  currentDesign, 
  onDesignLoad, 
  onDesignSave 
}: DesignManagerProps) => {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [designName, setDesignName] = useState(currentDesign.name);

  // Load designs on component mount
  useEffect(() => {
    loadDesigns();
  }, []);

  // Update design name when current design changes
  useEffect(() => {
    setDesignName(currentDesign.name);
  }, [currentDesign.name]);

  const loadDesigns = async () => {
    try {
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedDesigns = data.map(d => ({
        id: d.id,
        name: d.name,
        canvasWidth: d.canvas_width,
        canvasHeight: d.canvas_height,
        elements: (d.elements as any) || [],
        thumbnailUrl: d.thumbnail_url || undefined
      }));

      setDesigns(formattedDesigns);
    } catch (error) {
      console.error('Error loading designs:', error);
      toast.error('Failed to load designs');
    }
  };

  const saveDesign = async () => {
    if (!designName.trim()) {
      toast.error('Please enter a design name');
      return;
    }

    setIsLoading(true);
    try {
      // Generate thumbnail first
      toast('Generating thumbnail...');
      let thumbnailUrl = null;
      
      try {
        thumbnailUrl = await generateCanvasThumbnail(currentDesign);
        console.log('✅ Thumbnail generated successfully');
      } catch (error) {
        console.warn('⚠️ Failed to generate thumbnail:', error);
        // Continue with save even if thumbnail fails
      }

      const designData = {
        name: designName.trim(),
        canvas_width: currentDesign.canvasWidth,
        canvas_height: currentDesign.canvasHeight,
        elements: currentDesign.elements as any,
        thumbnail_url: thumbnailUrl
      };

      let result;
      if (currentDesign.id) {
        // Update existing design
        result = await supabase
          .from('designs')
          .update(designData)
          .eq('id', currentDesign.id)
          .select()
          .single();
      } else {
        // Create new design
        result = await supabase
          .from('designs')
          .insert(designData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      const savedDesign = {
        id: result.data.id,
        name: result.data.name,
        canvasWidth: result.data.canvas_width,
        canvasHeight: result.data.canvas_height,
        elements: (result.data.elements as any) || [],
        thumbnailUrl: result.data.thumbnail_url || undefined
      };

      onDesignSave(savedDesign);
      loadDesigns();
      toast.success('Design saved successfully');
    } catch (error) {
      console.error('Error saving design:', error);
      toast.error('Failed to save design');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDesign = async (design: Design) => {
    onDesignLoad(design);
    toast.success(`Loaded "${design.name}"`);
  };

  const regenerateThumbnail = async (design: Design) => {
    if (!design.id) return;
    
    try {
      toast('Regenerating thumbnail...');
      const thumbnailUrl = await generateCanvasThumbnail(design);
      
      // Update in database
      await supabase
        .from('designs')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', design.id);
      
      // Reload designs to show updated thumbnail
      loadDesigns();
      toast.success('Thumbnail regenerated successfully');
    } catch (error) {
      console.error('Error regenerating thumbnail:', error);
      toast.error('Failed to regenerate thumbnail');
    }
  };

  const deleteDesign = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return;

    try {
      const { error } = await supabase
        .from('designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;

      loadDesigns();
      toast.success('Design deleted');
    } catch (error) {
      console.error('Error deleting design:', error);
      toast.error('Failed to delete design');
    }
  };

  const createNewDesign = () => {
    const newDesign: Design = {
      name: 'New Design',
      canvasWidth: 842,
      canvasHeight: 595,
      elements: []
    };
    onDesignLoad(newDesign);
    setDesignName('New Design');
    toast.success('Created new design');
  };

  return (
    <div className="space-y-4">
      {/* Current Design */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Current Design</h3>
        
        <div className="space-y-2">
          <Label htmlFor="designName" className="text-xs text-muted-foreground">
            Design Name
          </Label>
          <Input
            id="designName"
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            className="h-8"
            placeholder="Enter design name"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={saveDesign}
            disabled={isLoading}
            size="sm"
            className="flex items-center gap-1 flex-1"
          >
            <Save className="w-3 h-3" />
            Save
          </Button>
          <Button 
            onClick={createNewDesign}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Canvas Size */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Canvas Size</Label>
        <div className="text-xs text-muted-foreground">
          {currentDesign.canvasWidth} × {currentDesign.canvasHeight}px
        </div>
        <div className="text-xs text-muted-foreground">
          A4 Landscape (842 × 595 points)
        </div>
      </div>

      <Separator />

      {/* Saved Designs */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Saved Designs</h3>
        
        {designs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved designs yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {designs.map(design => (
              <Card key={design.id} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium truncate">{design.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {design.elements.length} elements
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        onClick={() => loadDesign(design)}
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        title="Load Design"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => regenerateThumbnail(design)}
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        title="Regenerate Thumbnail"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => design.id && deleteDesign(design.id)}
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        title="Delete Design"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {design.thumbnailUrl && (
                    <div className="w-full h-20 bg-gray-50 rounded border overflow-hidden">
                      <img 
                        src={design.thumbnailUrl} 
                        alt={design.name}
                        className="w-full h-full object-contain"
                        style={{ 
                          imageRendering: 'crisp-edges'
                        }}
                      />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};