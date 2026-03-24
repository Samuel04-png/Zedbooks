import{r as pe,j as t}from"./react-vendor-a70FWiba.js";import{b as he,u as V,c as $}from"./tanstack-BzZYHevh.js";import{b_ as xe,bU as E,bY as T,bV as F,bX as k,c6 as ge,c0 as fe,bZ as h}from"./vendor-sdCs4eAZ.js";import{B as Y}from"./badge-Cu_oAA_N.js";import{u as ye,k as ve,l as je,c as w,B as G,I as J,D as be,m as we,n as Ne,o as X,p as N,q as ee,C as q,r as A}from"./index-Dgp7LcZC.js";import{C as De,a as Ie,b as Me,d as Se}from"./card-Dfp5NS0b.js";import{T as Ce,a as _e,b as B,c as x,d as Pe,e as m}from"./table-D0q9s_op.js";import"./firebase-CkG4OC4W.js";import{a as O}from"./accountingService-C7ecQi2H.js";import"./dashboardService-fXc32lW3.js";import{aN as $e,as as te,aO as Ee,aP as Te,aQ as Fe,am as ke,aR as qe}from"./ui-vendor-DlTg0ryV.js";import{f as v}from"./date-vendor-DmVitQ6f.js";const Ae=[{value:"Draft",label:"Mark as Draft"},{value:"Unpaid",label:"Mark as Unpaid"},{value:"Overdue",label:"Mark as Overdue"},{value:"Cancelled",label:"Cancel invoice"}],Be=(d,g)=>{const o=[];for(let j=0;j<d.length;j+=g)o.push(d.slice(j,j+g));return o},ae=d=>{if(!d)return"";if(typeof d=="string")return d;if(d instanceof Date)return d.toISOString();if(typeof d=="object"&&d!==null&&"toDate"in d){const g=d;if(typeof g.toDate=="function")return g.toDate().toISOString()}return""},D=d=>d.trim().toLowerCase(),i=d=>d.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");function Ge(){const[d,g]=pe.useState(""),{user:o}=ye(),j=xe(),{data:R}=ve(),p=he(),M=je(),se=["super_admin","admin","financial_manager","accountant","assistant_accountant"].includes(R||""),S=["super_admin","admin","financial_manager","accountant","assistant_accountant","finance_officer","bookkeeper","cashier"].includes(R||""),C=()=>{p.invalidateQueries({queryKey:["invoices"]}),p.invalidateQueries({queryKey:["accounts-receivable"]}),p.invalidateQueries({queryKey:["customers"]}),p.invalidateQueries({queryKey:["sales-orders"]}),p.invalidateQueries({queryKey:["estimates"]}),p.invalidateQueries({queryKey:["bank-accounts"]}),p.invalidateQueries({queryKey:["journal-entries"]}),p.invalidateQueries({queryKey:["financial-reports"]}),p.invalidateQueries({queryKey:["dashboard"]})},{data:Q}=V({queryKey:["invoice-actions-company-id",o==null?void 0:o.id],queryFn:async()=>{if(!o)return null;const e=await w.getPrimaryMembershipByUser(o.id);return(e==null?void 0:e.companyId)??null},enabled:!!o}),{data:_,isLoading:re}=V({queryKey:["invoices",o==null?void 0:o.id],queryFn:async()=>{if(!o)return[];const e=await w.getPrimaryMembershipByUser(o.id);if(!(e!=null&&e.companyId))return[];const a=E(A,q.INVOICES),u=(await T(F(a,k("companyId","==",e.companyId)))).docs.map(n=>{const r=n.data();return{id:n.id,invoiceNumber:String(r.invoiceNumber??r.invoice_number??""),invoiceDate:ae(r.invoiceDate??r.invoice_date),dueDate:ae(r.dueDate??r.due_date)||null,customerId:r.customerId??r.customer_id??null,customerName:"-",total:Number(r.totalAmount??r.total_amount??r.total??0),amountPaid:Number(r.amountPaid??r.amount_paid??0),balanceDue:Math.max(Number(r.totalAmount??r.total_amount??r.total??0)-Number(r.amountPaid??r.amount_paid??0),0),status:String(r.status??"draft"),journal_entry_id:r.journalEntryId??r.journal_entry_id??null}}),c=Array.from(new Set(u.map(n=>n.customerId).filter(Boolean))),y=new Map;if(c.length>0){const n=E(A,q.CUSTOMERS),r=Be(c,30);(await Promise.all(r.map(b=>T(F(n,k(ge(),"in",b)))))).forEach(b=>{b.docs.forEach(H=>{const me=H.data();y.set(H.id,String(me.name??"-"))})})}return u.map(n=>({...n,customerName:n.customerId&&y.get(n.customerId)||"-"})).sort((n,r)=>String(r.invoiceDate).localeCompare(String(n.invoiceDate)))},enabled:!!o}),U=$({mutationFn:async e=>{if(!o)throw new Error("Not authenticated");if(!e.journal_entry_id)throw new Error("Invoice has no posted journal entry to reverse.");if(Number(e.amountPaid||0)>.001)throw new Error("Reverse invoice payment entries first before reversing this invoice.");const a=await w.getPrimaryMembershipByUser(o.id);if(!(a!=null&&a.companyId))throw new Error("Company context not found");const s=prompt(`Reason for reversing invoice ${e.invoiceNumber} (optional):`)||void 0;return O.reverseJournalEntry({companyId:a.companyId,journalEntryId:e.journal_entry_id,reason:s})},onSuccess:()=>{C(),h.success("Invoice journal entry reversed")},onError:e=>{h.error(`Failed to reverse invoice: ${e.message}`)}}),I=$({mutationFn:async({invoice:e,status:a})=>{if(!o)throw new Error("Not authenticated");const s=await w.getPrimaryMembershipByUser(o.id);if(!(s!=null&&s.companyId))throw new Error("Company context not found");return O.updateInvoiceStatus({companyId:s.companyId,invoiceId:e.id,status:a})},onSuccess:(e,a)=>{C(),h.success(`Invoice ${a.invoice.invoiceNumber} updated to ${a.status}`)},onError:e=>{h.error(`Failed to update invoice status: ${e.message}`)}}),L=$({mutationFn:async e=>{if(!o)throw new Error("Not authenticated");const a=await w.getPrimaryMembershipByUser(o.id);if(!(a!=null&&a.companyId))throw new Error("Company context not found");return O.deleteInvoice({companyId:a.companyId,invoiceId:e.id})},onSuccess:(e,a)=>{C(),h.success(`Invoice ${a.invoiceNumber} deleted`)},onError:e=>{h.error(`Failed to delete invoice: ${e.message}`)}}),f=e=>new Intl.NumberFormat("en-ZM",{style:"currency",currency:"ZMW"}).format(e),ne=(e,a,s)=>{const u=a.reduce((n,r)=>n+r.lineTotal,0),c=Math.max(e.total-u,0);return`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${i(e.invoiceNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
      .page { max-width: 960px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }
      .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 32px; }
      .title { font-size: 34px; font-weight: 700; margin: 0 0 8px; }
      .muted { color: #475569; font-size: 14px; line-height: 1.6; }
      .pill { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #e2e8f0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
      .section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-bottom: 28px; }
      .card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; }
      .card h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { padding: 14px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .right { text-align: right; }
      .summary { margin-top: 24px; margin-left: auto; width: 320px; }
      .summary-row { display: flex; justify-content: space-between; padding: 8px 0; }
      .summary-total { font-size: 18px; font-weight: 700; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 14px; }
      .footer { margin-top: 36px; font-size: 13px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div>
          <p class="title">Invoice</p>
          <div class="muted">
            <div><strong>${i((s==null?void 0:s.name)||"Your Company")}</strong></div>
            <div>${i((s==null?void 0:s.email)||"-")}</div>
            <div>${i((s==null?void 0:s.phone)||"-")}</div>
            <div>${i((s==null?void 0:s.address)||"-")}</div>
            <div>TPIN: ${i((s==null?void 0:s.tpin)||"-")}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span class="pill">${i(e.status)}</span>
          <div class="muted" style="margin-top:12px;">
            <div><strong>Invoice #</strong> ${i(e.invoiceNumber)}</div>
            <div><strong>Invoice Date</strong> ${i(e.invoiceDate?v(new Date(e.invoiceDate),"dd MMM yyyy"):"-")}</div>
            <div><strong>Due Date</strong> ${i(e.dueDate?v(new Date(e.dueDate),"dd MMM yyyy"):"-")}</div>
          </div>
        </div>
      </div>

      <div class="section-grid">
        <div class="card">
          <h3>Bill To</h3>
          <div><strong>${i(e.customerName||"Customer")}</strong></div>
        </div>
        <div class="card">
          <h3>Account Summary</h3>
          <div class="summary-row"><span>Total</span><strong>${i(f(e.total))}</strong></div>
          <div class="summary-row"><span>Paid</span><strong>${i(f(e.amountPaid))}</strong></div>
          <div class="summary-row"><span>Balance Due</span><strong>${i(f(e.balanceDue))}</strong></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${a.map(n=>`
            <tr>
              <td>${i(n.description||"-")}</td>
              <td class="right">${i(n.quantity.toFixed(2))}</td>
              <td class="right">${i(f(n.unitPrice))}</td>
              <td class="right">${i(f(n.lineTotal))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><span>${i(f(u))}</span></div>
        <div class="summary-row"><span>Tax</span><span>${i(f(c))}</span></div>
        <div class="summary-row summary-total"><span>Total</span><span>${i(f(e.total))}</span></div>
      </div>

      

      <div class="footer">
        Generated from ZedBooks on ${i(v(new Date,"dd MMM yyyy HH:mm"))}
      </div>
    </div>
  </body>
</html>`},oe=async e=>{if(!o||!Q)throw new Error("Company context not found");const a=window.open("","_blank","noopener,noreferrer,width=1024,height=900");if(!a)throw new Error("Allow pop-ups to download invoices.");a.document.write('<p style="font-family: Arial, sans-serif; padding: 24px;">Preparing invoice...</p>'),a.document.close();try{const[s,u]=await Promise.all([w.getCompanyById(Q),T(F(E(A,q.INVOICE_ITEMS),k("invoiceId","==",e.id)))]),c=u.docs.map(n=>{const r=n.data(),P=Number(r.quantity??1),b=Number(r.unitPrice??r.unit_price??0);return{description:String(r.description??""),quantity:P,unitPrice:b,lineTotal:Number(r.lineTotal??r.line_total??P*b)}}),y=ne(e,c,s);a.document.open(),a.document.write(y),a.document.close(),window.setTimeout(()=>{a.focus(),a.print()},350)}catch(s){throw a.close(),s}},K=e=>{switch(D(e)){case"paid":return"default";case"overdue":return"destructive";case"draft":case"cancelled":return"outline";default:return"secondary"}},ie=e=>{var c;if(!S||Number(e.amountPaid||0)>.001)return[];const a=D(e.status||"draft"),s=new Date().toISOString().slice(0,10),u=((c=e.dueDate)==null?void 0:c.slice(0,10))||"";return Ae.filter(y=>{const n=D(y.value);return!(n===a||(n==="draft"||n==="cancelled")&&e.journal_entry_id||n==="overdue"&&(!u||u>=s))})},de=e=>{if(Number(e.amountPaid||0)>.001){h.error("Reverse invoice payments first before reversing this invoice.");return}confirm("Reverse this invoice posting? This creates an opposite journal entry.")&&U.mutate(e)},Z=e=>S&&D(e.status||"draft")==="draft"&&!e.journal_entry_id&&Number(e.amountPaid||0)<=.001,W=e=>Z(e),ce=e=>S&&D(e.status||"draft")==="draft"&&Number(e.amountPaid||0)<=.001,le=e=>{if(!W(e)){h.error("Only unpaid draft invoices can be deleted.");return}confirm(`Delete invoice ${e.invoiceNumber}? This cannot be undone.`)&&L.mutate(e)},ue=async e=>{try{await oe(e)}catch(a){const s=a instanceof Error?a.message:"Failed to download invoice.";h.error(s)}},z=(e,a=!1)=>{const s=ie(e),u=!!e.journal_entry_id&&se;return t.jsxs(be,{children:[t.jsx(we,{asChild:!0,children:t.jsxs(G,{variant:"outline",size:"sm",className:a?"w-full justify-between":"gap-2",children:["Actions",t.jsx(Ee,{className:"h-4 w-4"})]})}),t.jsxs(Ne,{align:"end",className:"w-52",children:[t.jsx(X,{children:"Invoice actions"}),t.jsxs(N,{disabled:!Z(e),onSelect:()=>j(`/invoices/${e.id}/edit`),children:[t.jsx(Te,{className:"mr-2 h-4 w-4"}),"Edit"]}),t.jsxs(N,{disabled:!ce(e)||I.isPending,onSelect:()=>I.mutate({invoice:e,status:"Unpaid"}),children:[t.jsx(Fe,{className:"mr-2 h-4 w-4"}),"Send"]}),t.jsxs(N,{onSelect:()=>ue(e),children:[t.jsx(ke,{className:"mr-2 h-4 w-4"}),"Save & Download"]}),t.jsxs(N,{disabled:!W(e)||L.isPending,onSelect:()=>le(e),className:"text-destructive focus:text-destructive",children:[t.jsx(qe,{className:"mr-2 h-4 w-4"}),"Delete"]}),s.length>0&&t.jsxs(t.Fragment,{children:[t.jsx(ee,{}),t.jsx(X,{children:"Change status"}),s.map(c=>t.jsx(N,{disabled:I.isPending,onSelect:()=>I.mutate({invoice:e,status:c.value}),children:c.label},`${e.id}-${c.value}`))]}),u&&t.jsxs(t.Fragment,{children:[s.length>0&&t.jsx(ee,{}),t.jsx(N,{disabled:U.isPending||Number(e.amountPaid||0)>.001,onSelect:()=>de(e),children:"Reverse posting"})]})]})]})},l=_==null?void 0:_.filter(e=>e.invoiceNumber.toLowerCase().includes(d.toLowerCase())||e.customerName.toLowerCase().includes(d.toLowerCase()));return re?t.jsx("div",{children:"Loading..."}):t.jsxs("div",{className:"space-y-6",children:[t.jsxs("div",{className:"flex items-center justify-between",children:[t.jsxs("div",{children:[t.jsx("h1",{className:"text-3xl font-bold tracking-tight text-foreground",children:"Invoices"}),t.jsx("p",{className:"text-muted-foreground",children:"Manage customer invoices and payments"})]}),t.jsx(fe,{to:"/invoices/new",children:t.jsxs(G,{className:"gap-2",children:[t.jsx($e,{className:"h-4 w-4"}),"New Invoice"]})})]}),t.jsxs(De,{children:[t.jsxs(Ie,{children:[t.jsxs("div",{className:"flex items-center justify-between",children:[t.jsx(Me,{children:"All Invoices"}),!M&&t.jsxs("div",{className:"relative w-64",children:[t.jsx(te,{className:"absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"}),t.jsx(J,{placeholder:"Search invoices...",value:d,onChange:e=>g(e.target.value),className:"pl-8"})]})]}),M&&t.jsxs("div",{className:"relative mt-4",children:[t.jsx(te,{className:"absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"}),t.jsx(J,{placeholder:"Search invoices...",value:d,onChange:e=>g(e.target.value),className:"pl-8 w-full"})]})]}),t.jsx(Se,{children:M?t.jsxs("div",{className:"space-y-4",children:[l==null?void 0:l.map(e=>t.jsxs("div",{className:"border rounded-lg p-4 space-y-3 bg-card shadow-sm",children:[t.jsxs("div",{className:"flex items-start justify-between gap-3",children:[t.jsxs("div",{children:[t.jsx("span",{className:"font-semibold text-foreground",children:e.invoiceNumber}),t.jsx("p",{className:"text-sm text-muted-foreground",children:e.customerName||"-"})]}),t.jsx(Y,{variant:K(e.status||"draft"),children:e.status})]}),t.jsxs("div",{className:"grid grid-cols-2 gap-2 text-sm",children:[t.jsxs("div",{children:[t.jsx("p",{className:"text-xs text-muted-foreground",children:"Date"}),t.jsx("p",{children:e.invoiceDate?v(new Date(e.invoiceDate),"dd MMM yyyy"):"-"})]}),t.jsxs("div",{children:[t.jsx("p",{className:"text-xs text-muted-foreground",children:"Due Date"}),t.jsx("p",{children:e.dueDate?v(new Date(e.dueDate),"dd MMM yyyy"):"-"})]})]}),t.jsxs("div",{className:"pt-2 border-t flex items-center justify-between",children:[t.jsx("span",{className:"text-sm font-medium text-muted-foreground",children:"Total Amount"}),t.jsxs("span",{className:"text-lg font-bold text-primary",children:["ZMW ",e.total.toFixed(2)]})]}),t.jsxs("div",{className:"grid grid-cols-2 gap-2 text-sm",children:[t.jsxs("div",{children:[t.jsx("p",{className:"text-xs text-muted-foreground",children:"Paid"}),t.jsxs("p",{children:["ZMW ",e.amountPaid.toFixed(2)]})]}),t.jsxs("div",{children:[t.jsx("p",{className:"text-xs text-muted-foreground",children:"Balance"}),t.jsxs("p",{className:"font-medium",children:["ZMW ",e.balanceDue.toFixed(2)]})]})]}),t.jsx("div",{className:"pt-2",children:z(e,!0)})]},e.id)),(l==null?void 0:l.length)===0&&t.jsx("div",{className:"text-center p-4 text-muted-foreground",children:"No invoices found"})]}):t.jsxs(Ce,{children:[t.jsx(_e,{children:t.jsxs(B,{children:[t.jsx(x,{children:"Invoice #"}),t.jsx(x,{children:"Date"}),t.jsx(x,{children:"Customer"}),t.jsx(x,{children:"Due Date"}),t.jsx(x,{className:"text-right",children:"Amount"}),t.jsx(x,{className:"text-right",children:"Paid"}),t.jsx(x,{className:"text-right",children:"Balance"}),t.jsx(x,{children:"Status"}),t.jsx(x,{className:"text-right",children:"Actions"})]})}),t.jsxs(Pe,{children:[l==null?void 0:l.map(e=>t.jsxs(B,{children:[t.jsx(m,{className:"font-medium",children:e.invoiceNumber}),t.jsx(m,{children:e.invoiceDate?v(new Date(e.invoiceDate),"dd MMM yyyy"):"-"}),t.jsx(m,{children:e.customerName||"-"}),t.jsx(m,{children:e.dueDate?v(new Date(e.dueDate),"dd MMM yyyy"):"-"}),t.jsxs(m,{className:"text-right font-medium",children:["ZMW ",e.total.toFixed(2)]}),t.jsxs(m,{className:"text-right",children:["ZMW ",e.amountPaid.toFixed(2)]}),t.jsxs(m,{className:"text-right font-medium",children:["ZMW ",e.balanceDue.toFixed(2)]}),t.jsx(m,{children:t.jsx(Y,{variant:K(e.status||"draft"),children:e.status})}),t.jsx(m,{className:"text-right",children:t.jsx("div",{className:"flex justify-end",children:z(e)})})]},e.id)),(l==null?void 0:l.length)===0&&t.jsx(B,{children:t.jsx(m,{colSpan:9,className:"text-center text-muted-foreground",children:"No invoices found"})})]})]})})]})]})}export{Ge as default};
