import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { DesignElement } from '../StickerDesigner';
import { MoveUp, MoveDown, Trash2 } from 'lucide-react';

interface PropertiesPanelProps {
  selectedElement: DesignElement | null;
  onElementUpdate: (elementId: string, updates: Partial<DesignElement>) => void;
  onElementDelete?: (elementId: string) => void;
}

export const PropertiesPanel = ({ selectedElement, onElementUpdate, onElementDelete }: PropertiesPanelProps) => {
  if (!selectedElement) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">Properties</h3>
        <p className="text-sm text-muted-foreground">Select an element to edit its properties</p>
      </div>
    );
  }

  const updateProperty = (key: string, value: any) => {
    console.log('🔧 PropertiesPanel - Updating property:', key, 'to:', value);
    console.log('🔧 PropertiesPanel - Current properties before update:', selectedElement.properties);
    
    const updatedProperties = {
      ...selectedElement.properties,
      [key]: value
    };
    
    console.log('🔧 PropertiesPanel - New properties:', updatedProperties);
    
    onElementUpdate(selectedElement.id, {
      properties: updatedProperties
    });
  };

  const updateTransform = (key: keyof DesignElement, value: any) => {
    onElementUpdate(selectedElement.id, { [key]: value });
  };

  const fontOptions = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
    'Trebuchet MS', 'Courier New', 'Lucida Console', 'Comic Sans MS', 'Impact'
  ];

  const dateFormats = [
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
    { label: 'DD-MM-YYYY', value: 'DD-MM-YYYY' },
    { label: 'Month DD, YYYY', value: 'Month DD, YYYY' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Properties</h3>
        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => updateTransform('zIndex', selectedElement.zIndex + 1)}
          >
            <MoveUp className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => updateTransform('zIndex', Math.max(0, selectedElement.zIndex - 1))}
          >
            <MoveDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Position & Size */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Position & Size</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="x" className="text-xs text-muted-foreground">X</Label>
            <Input
              id="x"
              type="number"
              value={Math.round(selectedElement.x)}
              onChange={(e) => updateTransform('x', Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="y" className="text-xs text-muted-foreground">Y</Label>
            <Input
              id="y"
              type="number"
              value={Math.round(selectedElement.y)}
              onChange={(e) => updateTransform('y', Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="width" className="text-xs text-muted-foreground">Width</Label>
            <Input
              id="width"
              type="number"
              value={Math.round(selectedElement.width)}
              onChange={(e) => updateTransform('width', Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="height" className="text-xs text-muted-foreground">Height</Label>
            <Input
              id="height"
              type="number"
              value={Math.round(selectedElement.height)}
              onChange={(e) => updateTransform('height', Number(e.target.value))}
              className="h-8"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="rotation" className="text-xs text-muted-foreground">Rotation (°)</Label>
          <Input
            id="rotation"
            type="number"
            value={Math.round(selectedElement.rotation)}
            onChange={(e) => updateTransform('rotation', Number(e.target.value))}
            className="h-8"
          />
        </div>
      </div>

      <Separator />

      {/* Type-specific properties */}
      {selectedElement.type === 'text' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Text Properties</Label>
          
          <div>
            <Label htmlFor="text" className="text-xs text-muted-foreground">Text</Label>
            <Input
              id="text"
              value={selectedElement.properties.text || ''}
              onChange={(e) => updateProperty('text', e.target.value)}
              className="h-8"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="fontSize" className="text-xs text-muted-foreground">Font Size</Label>
              <Input
                id="fontSize"
                type="number"
                value={selectedElement.properties.fontSize || 16}
                onChange={(e) => updateProperty('fontSize', Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="color" className="text-xs text-muted-foreground">Color</Label>
              <Input
                id="color"
                type="color"
                value={selectedElement.properties.color || '#000000'}
                onChange={(e) => updateProperty('color', e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fontFamily" className="text-xs text-muted-foreground">Font Family</Label>
            <Select
              value={selectedElement.properties.fontFamily || 'Arial'}
              onValueChange={(value) => updateProperty('fontFamily', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map(font => (
                  <SelectItem key={font} value={font}>{font}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="alignment" className="text-xs text-muted-foreground">Alignment</Label>
            <Select
              value={selectedElement.properties.alignment || 'left'}
              onValueChange={(value) => updateProperty('alignment', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bold"
                checked={selectedElement.properties.bold || false}
                onCheckedChange={(checked) => updateProperty('bold', checked)}
              />
              <Label htmlFor="bold" className="text-xs">Bold</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="italic"
                checked={selectedElement.properties.italic || false}
                onCheckedChange={(checked) => updateProperty('italic', checked)}
              />
              <Label htmlFor="italic" className="text-xs">Italic</Label>
            </div>
          </div>
        </div>
      )}

      {selectedElement.type === 'image' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Image Properties</Label>
          
          <div>
            <Label htmlFor="imageUrl" className="text-xs text-muted-foreground">Image URL</Label>
            <Input
              id="imageUrl"
              value={selectedElement.properties.url || ''}
              onChange={(e) => updateProperty('url', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      )}

      {selectedElement.type === 'date' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Date Properties</Label>
          
          <div>
            <Label htmlFor="dateFormat" className="text-xs text-muted-foreground">Date Format</Label>
            <Select
              value={selectedElement.properties.format || 'DD/MM/YYYY'}
              onValueChange={(value) => updateProperty('format', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFormats.map(format => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="dateFontSize" className="text-xs text-muted-foreground">Font Size</Label>
              <Input
                id="dateFontSize"
                type="number"
                value={selectedElement.properties.fontSize || 16}
                onChange={(e) => updateProperty('fontSize', Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="dateColor" className="text-xs text-muted-foreground">Color</Label>
              <Input
                id="dateColor"
                type="color"
                value={selectedElement.properties.color || '#000000'}
                onChange={(e) => updateProperty('color', e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dateFontFamily" className="text-xs text-muted-foreground">Font Family</Label>
            <Select
              value={selectedElement.properties.fontFamily || 'Arial'}
              onValueChange={(value) => updateProperty('fontFamily', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map(font => (
                  <SelectItem key={font} value={font}>{font}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Delete Button */}
      {onElementDelete && (
        <>
          <Separator />
          <Button 
            variant="destructive" 
            onClick={() => onElementDelete(selectedElement.id)}
            className="w-full flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Element
          </Button>
        </>
      )}
    </div>
  );
};