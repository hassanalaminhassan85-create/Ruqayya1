import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
`    const remainingVehicleBalance =
      rawInitialRemaining !== undefined &&
      !isNaN(parseFloat(rawInitialRemaining))
        ? Math.max(0, parseFloat(rawInitialRemaining) - totalErpPaid)
        : Math.max(0, importedPurchasePrice - totalAmountPaid);

    return {
      vehiclePurchasePrice: importedPurchasePrice,`,
`    const remainingVehicleBalance = Math.max(0, importedPurchasePrice - totalAmountPaid);

    return {
      vehiclePurchasePrice: basePurchasePrice,`);

fs.writeFileSync('server.ts', content);
