import re

file_path = 'server.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Allow admins to register admins
content = content.replace(
"""app.post('/api/auth/register-admin', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {""",
"""app.post('/api/auth/register-admin', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {""")

content = content.replace(
"""app.post('/api/director/admins', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {""",
"""app.post('/api/director/admins', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {""")

content = content.replace(
"""app.put('/api/director/admins/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {""",
"""app.put('/api/director/admins/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {""")

content = content.replace(
"""app.delete('/api/director/admins/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director') {""",
"""app.delete('/api/director/admins/:id', authenticateSession, (req, res) => {
  try {
    const actor = (req as any).user;
    if (actor.role !== 'director' && actor.role !== 'admin') {""")

with open(file_path, 'w') as f:
    f.write(content)
print("Server patched for Admins!")
