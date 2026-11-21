import { TextField, InputAdornment, Box } from '@mui/material';
import { isHex } from '../lib/validators';

export default function ColorField({ label, value, onChange, helperText }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={!isHex(value)}
      helperText={!isHex(value) ? 'Format #RRGGBB' : helperText}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Box component="input" type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)}
              sx={{ width: 28, height: 28, border: 0, p: 0, bgcolor: 'transparent', cursor: 'pointer' }} />
          </InputAdornment>
        )
      }}
    />
  );
}
