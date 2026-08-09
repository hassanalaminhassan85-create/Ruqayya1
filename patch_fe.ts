import fs from 'fs';

let content = fs.readFileSync('src/components/admin/FinancialCommandCenter.tsx', 'utf-8');

content = content.replace(
`    const rawPrice = parseFloat(drv.vehicle_purchase_price ?? drv.vehiclePurchasePrice) || 5000000;
    const vehiclePrice = rawPrice > 500000 ? rawPrice : 5000000;
    const remainingVeh = Math.max(0, vehiclePrice - paid);
    const expenseDebits = (drv.expenseHistory || []).reduce((sum, ex: any) => sum + (parseFloat(ex.amount) || 0), 0);
    const currentInstNum = Math.min(6, Math.floor(paid / instDue) + 1);`,
`    const rawPrice = parseFloat(drv.vehicle_purchase_price ?? drv.vehiclePurchasePrice) || 5000000;
    const vehiclePrice = rawPrice > 500000 ? rawPrice : 5000000;
    const expenseDebits = (drv.expenseHistory || []).reduce((sum, ex: any) => sum + (parseFloat(ex.amount) || 0), 0);
    const remainingVeh = Math.max(0, (vehiclePrice + expenseDebits) - paid);
    const currentInstNum = Math.min(6, Math.floor(paid / instDue) + 1);`);

fs.writeFileSync('src/components/admin/FinancialCommandCenter.tsx', content);
