import { apiRequest } from './client'
export type ExpenseStatus='Paid'|'Verifying'|'To pay'|'Overdue'|'Cancelled'
export type Expense={id:string;expenseDate:string;payee:string;category:string;description:string;amount:number;paymentMethod:string;purchaser:string;status:ExpenseStatus;invoiceUrl:string;notes:string;quotationId:string|null;quotationNumber:string;projectName:string;purchaseOrderId:string|null;voidReason:string|null;createdAt:string;updatedAt:string;archivedAt:string|null;version:number}
export type SaveExpense={expenseDate:string;payee:string;category:string;description:string;amount:number;paymentMethod:string;purchaser:string;status:ExpenseStatus;invoiceUrl:string;notes:string;quotationId:string|null;quotationNumber:string;projectName:string;purchaseOrderId:string|null;version?:number}
export type ExpensePage={items:Expense[];page:number;pageSize:number;total:number}
export const listExpenses=(q:{search?:string;status?:ExpenseStatus;archivedOnly?:boolean;page?:number;pageSize?:number}={})=>{const p=new URLSearchParams();if(q.search)p.set('search',q.search);if(q.status)p.set('status',q.status);if(q.archivedOnly)p.set('archivedOnly','true');p.set('page',String(q.page??1));p.set('pageSize',String(q.pageSize??100));return apiRequest<ExpensePage>('/expenses?'+p)}
export const createExpense=(value:SaveExpense)=>apiRequest<Expense>('/expenses',{method:'POST',body:JSON.stringify(value)})
export const updateExpense=(id:string,value:SaveExpense)=>apiRequest<Expense>('/expenses/'+id,{method:'PUT',body:JSON.stringify(value)})
export const changeExpenseStatus=(id:string,value:{status:ExpenseStatus;reason?:string;version:number;archiveAfterVoiding?:boolean})=>apiRequest<Expense>('/expenses/'+id+'/status',{method:'POST',body:JSON.stringify(value)})
export const archiveExpense=(id:string,version:number)=>apiRequest<Expense>('/expenses/'+id+'/archive',{method:'POST',body:JSON.stringify({version})})
export const restoreExpense=(id:string,version:number)=>apiRequest<Expense>('/expenses/'+id+'/restore',{method:'POST',body:JSON.stringify({version})})
