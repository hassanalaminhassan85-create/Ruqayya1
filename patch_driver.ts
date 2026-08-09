import fs from 'fs';

let content = fs.readFileSync('src/features/DriverDashboard.tsx', 'utf-8');

content = content.replace(
`      const rawRegBal = driverData?.remaining_vehicle_balance ?? driverData?.remainingVehicleBalance;
      const regBal = rawRegBal !== undefined && rawRegBal !== null ? parseFloat(rawRegBal) || 0 : 0;
      const baseBal = (rawRegBal !== undefined && rawRegBal !== null && rawRegBal !== '') ? regBal : vehiclePrice;
      
      const computedRemBal = Math.max(0, baseBal - totalPaymentsAmt + totalExpensesAmt);`,
`      const baseBal = vehiclePrice;
      const computedRemBal = Math.max(0, baseBal - totalPaymentsAmt + totalExpensesAmt);`);

content = content.replace(
`  // Dynamic Registered Balance
  const rawRegisteredBal = driverData?.remaining_vehicle_balance ?? driverData?.remainingVehicleBalance;
  const registeredRemainingBalance = rawRegisteredBal !== undefined && rawRegisteredBal !== null ? parseFloat(rawRegisteredBal) || 0 : 0;
  
  // Initialized with registered balance (if explicitly provided) else full purchase price
  const baseBalance = (rawRegisteredBal !== undefined && rawRegisteredBal !== null && rawRegisteredBal !== '') ? registeredRemainingBalance : vehiclePurchasePrice;
  const remainingVehicleBalance = Math.max(0, baseBalance - totalPaymentsAmount + totalExpensesAmount);`,
`  // Initialized with registered balance (if explicitly provided) else full purchase price
  const baseBalance = vehiclePurchasePrice;
  const remainingVehicleBalance = Math.max(0, baseBalance - totalPaymentsAmount + totalExpensesAmount);`);

fs.writeFileSync('src/features/DriverDashboard.tsx', content);
