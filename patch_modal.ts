import fs from 'fs';

let content = fs.readFileSync('src/components/admin/Driver360Modal.tsx', 'utf-8');

content = content.replace(
`  const rawRegisteredBal = (activeDriver as any).remaining_vehicle_balance ?? (activeDriver as any).remainingVehicleBalance;
  const registeredRemainingBalance = rawRegisteredBal !== undefined && rawRegisteredBal !== null ? parseFloat(rawRegisteredBal) || 0 : 0;
  
  // Computed Remaining Vehicle Purchase Balance
  // Initialized with registered balance (if explicitly provided) else full purchase price
  const baseBalance = (rawRegisteredBal !== undefined && rawRegisteredBal !== null && rawRegisteredBal !== '') ? registeredRemainingBalance : vehiclePurchasePrice;
  const remainingVehicleBalance = Math.max(0, baseBalance - totalPaymentsAmount + totalExpensesAmount);`,
`  // Computed Remaining Vehicle Purchase Balance
  // The API returns vehiclePurchasePrice as the static base price, and remaining_vehicle_balance as the computed current balance.
  // We can just compute it directly from base to be safe against double-counting.
  const baseBalance = vehiclePurchasePrice;
  const remainingVehicleBalance = Math.max(0, baseBalance - totalPaymentsAmount + totalExpensesAmount);`);

fs.writeFileSync('src/components/admin/Driver360Modal.tsx', content);
