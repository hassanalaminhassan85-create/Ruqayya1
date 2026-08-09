import fs from 'fs';

let content = fs.readFileSync('src/features/DriverDashboard.tsx', 'utf-8');

content = content.replace(
`  // Dynamic Registered Balance
  const rawRegisteredBal = driverData?.remaining_vehicle_balance ?? driverData?.remainingVehicleBalance;
  const registeredRemainingBalance = rawRegisteredBal !== undefined && rawRegisteredBal !== null ? parseFloat(rawRegisteredBal) || 0 : 0;
  
  // Initialized with registered balance (if explicitly provided) else full purchase price
  const baseBalance = (rawRegisteredBal !== undefined && rawRegisteredBal !== null && rawRegisteredBal !== '') ? registeredRemainingBalance : vehiclePurchasePrice;`,
`  // Initialized with full purchase price
  const baseBalance = vehiclePurchasePrice;`);

fs.writeFileSync('src/features/DriverDashboard.tsx', content);
