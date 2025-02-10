import { Box, Flex, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger } from '@invoke-ai/ui-library';
import RgbaColorPicker from 'common/components/ColorPicker/RgbaColorPicker';
import type { ChangeEvent, FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RgbaColor } from 'react-colorful/dist/types';
import { useTranslation } from 'react-i18next';
import { MdDelete, MdPalette } from 'react-icons/md';

interface TextToolbarProps {
  onChange: (changes: { fontSize?: number; color?: string; fontStyle?: string; fontFamily?: string }) => void;
  onClose: () => void;
  onDelete: () => void;
  textProperties: {
    fontSize: number;
    color?: string;
    fontStyle: string;
    fontFamily: string;
  };
}

const parseColor = (color: string | undefined): RgbaColor => {
  const safeColor = color ?? '#fff';
  if (safeColor.startsWith('#')) {
    const bigint = parseInt(safeColor.slice(1), 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255, a: 1 };
  } else if (safeColor.startsWith('rgba')) {
    const match = safeColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (match) {
      return {
        r: parseInt(match[1]!, 10),
        g: parseInt(match[2]!, 10),
        b: parseInt(match[3]!, 10),
        a: parseFloat(match[4]!),
      };
    }
  }
  return { r: 255, g: 255, b: 255, a: 1 };
};

const rgbaToCssString = (rgba: RgbaColor): string => `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;

const TextToolbar: FC<TextToolbarProps> = ({ onChange, onDelete, textProperties }) => {
  const { t } = useTranslation();
  const popoverOpen = useRef(false);
  const initialColor = parseColor(textProperties.color ?? '#fff');
  const [lastSelectedColor, setLastSelectedColor] = useState<RgbaColor>(initialColor);
  const [fontStyle, setFontStyle] = useState<string>(textProperties.fontStyle);
  const [fontFamily, setFontFamily] = useState<string>(textProperties.fontFamily);

  useEffect(() => {
    if (!popoverOpen.current) {
      const newColor = parseColor(textProperties.color ?? '#fff');
      setLastSelectedColor(newColor);
    }
  }, [textProperties.color]);

  const handleColorChange = useCallback(
    (newColor: RgbaColor) => {
      setLastSelectedColor(newColor);
      onChange({ color: rgbaToCssString(newColor) });
    },
    [onChange]
  );

  const handleFontFamilyChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newFontFamily = e.target.value;
      setFontFamily(newFontFamily);
      onChange({ fontFamily: newFontFamily });
    },
    [onChange]
  );

  const handleFontStyleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newFontStyle = e.target.value;
      setFontStyle(newFontStyle);
      onChange({ fontStyle: newFontStyle });
    },
    [onChange]
  );

  const handlePopoverOpen = useCallback(() => {
    popoverOpen.current = true;
  }, []);

  const handlePopoverClose = useCallback(() => {
    popoverOpen.current = false;
  }, []);

  const commonInputStyle: React.CSSProperties = {
    background: '#333',
    color: '#fff',
    border: '1px solid #666',
    borderRadius: '4px',
    fontSize: '16px',
    height: '40px',
    padding: '0 8px',
  };

  return (
    <Flex
      position="relative"
      alignItems="center"
      gap="4px"
      p="4px"
      bg="#222"
      borderRadius="4px"
      boxShadow="0 2px 6px rgba(0, 0, 0, 0.3)"
      zIndex="1000"
    >
      {/* FONT FAMILY */}
      <select value={fontFamily} onChange={handleFontFamilyChange} style={commonInputStyle}>
        {['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana', 'CustomFont'].map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>

      {/* FONT STYLE */}
      <select value={fontStyle} onChange={handleFontStyleChange} style={commonInputStyle}>
        <option value="normal">{t('Normal')}</option>
        <option value="bold">{t('Bold')}</option>
        <option value="italic">{t('Italic')}</option>
      </select>

      {/* COLOR PICKER */}
      <Popover isLazy placement="top" onOpen={handlePopoverOpen} onClose={handlePopoverClose}>
        <PopoverTrigger>
          <button style={commonInputStyle} title="Pick a Color">
            <MdPalette size={24} />
          </button>
        </PopoverTrigger>
        <PopoverContent bg="#222" borderRadius="4px" p="4" boxShadow="0 2px 6px rgba(0, 0, 0, 0.3)">
          <PopoverArrow />
          <PopoverBody>
            <Box>
              <RgbaColorPicker color={lastSelectedColor} onChange={handleColorChange} withNumberInput />
            </Box>
          </PopoverBody>
        </PopoverContent>
      </Popover>

      {/* DELETE BUTTON */}
      <button onClick={onDelete} style={commonInputStyle} title="Delete Text">
        <MdDelete size={24} />
      </button>
    </Flex>
  );
};

export default TextToolbar;
