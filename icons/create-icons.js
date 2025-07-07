// Simple icon generator for StopitHarassment PWA
// Run this in the browser console to generate basic icons

function generateIcons() {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    const iconColor = '#e94560'; // Primary red color
    const bgColor = '#1a1a2e';   // Dark background
    
    sizes.forEach(size => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        
        // Shield shape
        ctx.fillStyle = iconColor;
        ctx.beginPath();
        
        const centerX = size / 2;
        const centerY = size / 2;
        const shieldSize = size * 0.7;
        
        // Create shield path
        ctx.moveTo(centerX, centerY - shieldSize/2);
        ctx.quadraticCurveTo(centerX + shieldSize/3, centerY - shieldSize/2, centerX + shieldSize/2, centerY - shieldSize/4);
        ctx.lineTo(centerX + shieldSize/2, centerY + shieldSize/4);
        ctx.quadraticCurveTo(centerX, centerY + shieldSize/2, centerX, centerY + shieldSize/2);
        ctx.quadraticCurveTo(centerX, centerY + shieldSize/2, centerX - shieldSize/2, centerY + shieldSize/4);
        ctx.lineTo(centerX - shieldSize/2, centerY - shieldSize/4);
        ctx.quadraticCurveTo(centerX - shieldSize/3, centerY - shieldSize/2, centerX, centerY - shieldSize/2);
        ctx.closePath();
        ctx.fill();
        
        // Add SOS text
        if (size >= 128) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${size/8}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SOS', centerX, centerY);
        }
        
        // Convert to blob and download
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `icon-${size}x${size}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    });
    
    console.log('Icons generated! Check your downloads folder.');
}

// Run the generator
generateIcons();