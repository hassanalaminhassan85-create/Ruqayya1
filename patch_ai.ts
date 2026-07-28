import fs from 'fs';

let content = fs.readFileSync('functions/api/[[path]].ts', 'utf-8');

const targetStr = `    if (stream) {
      const aiService = new WorkersAIService(env);`;

const replacementStr = `    if (stream) {
      if (path === '/api/ai/chat' && env.GEMINI_API_KEY && (actor.role === 'admin' || actor.role === 'director')) {
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        
        (async () => {
          try {
            const { GoogleGenAI, Type } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
            
            const functionDeclarations = [
              {
                name: "record_driver_installment",
                description: "Record a driver paying an installment. This records their payment against the cycle. Optionally log an expense.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    driver_id: { type: Type.STRING },
                    cycle_id: { type: Type.STRING },
                    amount_paid: { type: Type.NUMBER },
                    expense_amount: { type: Type.NUMBER, description: "Optional expense amount (e.g. repairs/fines)" },
                    expense_category: { type: Type.STRING, description: "Optional expense category" },
                    expense_description: { type: Type.STRING, description: "Optional expense description" }
                  },
                  required: ["driver_id", "cycle_id", "amount_paid"]
                }
              },
              {
                name: "get_driver_balance",
                description: "Gets the live remaining balance, installments status, and total purchase amount for a specific driver.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    driver_id: { type: Type.STRING }
                  },
                  required: ["driver_id"]
                }
              }
            ];

            const systemInstruction = systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined;
            const chatHistory = history.map((h: any) => ({
              role: (h.role === 'assistant' ? 'model' : 'user'),
              parts: [{ text: h.content || '' }]
            }));
            
            chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
            
            const chat = ai.chats.create({
              model: 'gemini-3.6-flash',
              config: {
                systemInstruction,
                temperature: 0.2,
                tools: [{ functionDeclarations }]
              },
              history: chatHistory.slice(0, -1)
            });

            const userMessage = chatHistory[chatHistory.length - 1].parts[0].text;
            let response = await chat.sendMessage({ message: userMessage });
            
            let iterations = 0;
            while (response.functionCalls && response.functionCalls.length > 0 && iterations < 3) {
              iterations++;
              const calls = response.functionCalls;
              const functionResponses = [];

              for (const call of calls) {
                if (call.name === 'record_driver_installment') {
                  const args = call.args as any;
                  const driver = db.drivers.find((d: any) => d.id === args.driver_id || (d.fullName && d.fullName.toLowerCase().includes(args.driver_id.toLowerCase())));
                  if (!driver) {
                    functionResponses.push({ name: call.name, response: { error: "Driver not found" } });
                    continue;
                  }
                  
                  const paymentId = generateUUID();
                  const pAmount = Number(args.amount_paid);
                  
                  db.driver_payments.push({
                    id: paymentId,
                    driver_id: driver.id,
                    amount: pAmount,
                    installmentNumber: 0,
                    outstandingAmount: 0,
                    date: new Date().toISOString().split('T')[0],
                    receiptNumber: 'AI-REC-' + Math.floor(Math.random() * 10000),
                    status: 'approved',
                    remarks: 'Recorded via AI Assistant',
                    cycle_id: args.cycle_id
                  });

                  db.financial_records.push({
                    id: generateUUID(),
                    type: 'receipt',
                    amount: pAmount,
                    category: 'Driver Installment',
                    description: 'Payment by ' + (driver.fullName || driver.id),
                    date: new Date().toISOString().split('T')[0],
                    source: 'AI Assistant',
                    linked_payment_id: paymentId,
                    cycle_id: args.cycle_id
                  });
                  
                  if (args.expense_amount && Number(args.expense_amount) > 0) {
                    db.financial_records.push({
                      id: generateUUID(),
                      type: 'expense',
                      amount: Number(args.expense_amount),
                      category: args.expense_category || 'General Expense',
                      description: args.expense_description || 'Expense for ' + driver.fullName,
                      date: new Date().toISOString().split('T')[0],
                      source: 'AI Assistant',
                      cycle_id: args.cycle_id
                    });
                  }

                  writeAuditLog(actor.id, actor.email, actor.role, 'AI_PAYMENT_RECORDED', null, 'AI recorded payment N' + pAmount + ' for driver ' + driver.id, db);
                  await dbManager.saveDB(db);

                  const totalPaid = db.driver_payments
                    .filter((p: any) => p.driver_id === driver.id && p.status === 'approved')
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                  const newBalance = Math.max(0, (Number(driver.agreedAmount) || 0) - totalPaid);

                  functionResponses.push({ 
                    name: call.name, 
                    response: { 
                      success: true, 
                      driver_name: driver.fullName, 
                      amount_paid: pAmount, 
                      expense_recorded: !!args.expense_amount,
                      new_remaining_balance: newBalance 
                    } 
                  });
                } else if (call.name === 'get_driver_balance') {
                  const args = call.args as any;
                  const driver = db.drivers.find((d: any) => d.id === args.driver_id || (d.fullName && d.fullName.toLowerCase().includes(args.driver_id.toLowerCase())));
                  if (!driver) {
                    functionResponses.push({ name: call.name, response: { error: "Driver not found" } });
                    continue;
                  }
                  
                  const totalPaid = db.driver_payments
                    .filter((p: any) => p.driver_id === driver.id && p.status === 'approved')
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                  const remainingBalance = Math.max(0, (Number(driver.agreedAmount) || 0) - totalPaid);
                  
                  functionResponses.push({ 
                    name: call.name, 
                    response: { 
                      driver_name: driver.fullName,
                      total_purchase_amount: driver.agreedAmount,
                      total_paid: totalPaid,
                      remaining_balance: remainingBalance
                    } 
                  });
                }
              }

              response = await chat.sendMessage({ message: functionResponses as any });
            }

            const textResponse = response.text || '';
            const chunks = textResponse.match(/.{1,15}/g) || [];
            for (const chunk of chunks) {
              await writer.write(encoder.encode('data: ' + JSON.stringify({ text: chunk }) + '\n\n'));
              await new Promise(res => setTimeout(res, 20));
            }
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          } catch (e: any) {
            await writer.write(encoder.encode('data: ' + JSON.stringify({ error: e.message }) + '\n\n'));
          } finally {
            await writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
          }
        });
      }

      const aiService = new WorkersAIService(env);`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync('functions/api/[[path]].ts', content);
