import fs from 'fs';

let content = fs.readFileSync('src/components/admin/FinancialCommandCenter.tsx', 'utf-8');

content = content.replace(
`    const rawPrice = parseFloat(drv.vehicle_purchase_price ?? drv.vehiclePurchasePrice) || 5000000;
    const vehiclePrice = rawPrice > 500000 ? rawPrice : 5000000;`,
`    const rawPrice = parseFloat(drv.vehicle_purchase_price ?? drv.vehiclePurchasePrice) || 15000000;
    const vehiclePrice = rawPrice > 500000 ? rawPrice : 15000000;`);

fs.writeFileSync('src/components/admin/FinancialCommandCenter.tsx', content);
