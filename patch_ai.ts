import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

content = content.replace(
`    const importedPurchasePrice =
      (rawPrice !== undefined &&
      rawPrice !== null &&
      !isNaN(parseFloat(rawPrice)) &&
      parseFloat(rawPrice) > 0
        ? parseFloat(rawPrice)
        : Math.max(15000000, openingRemaining + openingPaid)) + totalExpenses;

    const totalAmountPaid = openingPaid + totalErpPaid;

    const remainingVehicleBalance =
      rawInitialRemaining !== undefined &&
      !isNaN(parseFloat(rawInitialRemaining))
        ? Math.max(0, parseFloat(rawInitialRemaining) - totalErpPaid)
        : Math.max(0, importedPurchasePrice - totalAmountPaid);

    return {
      vehiclePurchasePrice: importedPurchasePrice,`,
`    const importedPurchasePrice =
      (rawPrice !== undefined &&
      rawPrice !== null &&
      !isNaN(parseFloat(rawPrice)) &&
      parseFloat(rawPrice) > 0
        ? parseFloat(rawPrice)
        : Math.max(15000000, openingRemaining + openingPaid)) + totalExpenses;

    const totalAmountPaid = openingPaid + totalErpPaid;

    const remainingVehicleBalance = Math.max(0, importedPurchasePrice - totalAmountPaid);

    return {
      vehiclePurchasePrice: basePurchasePrice,`);

content = content.replace(
`  } else {
    // Native Driver
    const totalAmountPaid = totalErpPaid;
    
    // Use registered initial remaining balance if specified by driver/admin
    const validInitial = (rawInitialRemaining !== undefined && rawInitialRemaining !== null && !isNaN(parseFloat(rawInitialRemaining)))
      ? parseFloat(rawInitialRemaining)
      : purchasePrice;

    const remainingVehicleBalance = Math.max(0, validInitial - totalAmountPaid);

    return {
      vehiclePurchasePrice: purchasePrice,`,
`  } else {
    // Native Driver
    const totalAmountPaid = totalErpPaid;
    
    const remainingVehicleBalance = Math.max(0, purchasePrice - totalAmountPaid);

    return {
      vehiclePurchasePrice: basePurchasePrice,`);

fs.writeFileSync('server.ts', content);
