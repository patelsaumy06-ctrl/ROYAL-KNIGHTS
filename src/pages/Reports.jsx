import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { G, css } from '../styles/theme';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import ProgressBar from '../components/ProgressBar';
import Spinner from '../components/Spinner';

import Avatar from '../components/Avatar';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function Reports({ intelligence = null }) {
  const [chart,setChart] = useState(null);
  const { isMobile, isTablet } = useMediaQuery();

  useEffect(()=>{ api.getChartData().then(setChart); },[]);

  const handleDownloadPDF = async () => {
    const needs = await api.getNeeds();
    const stats = await api.getStats();
    const volunteers = await api.getVolunteers();
    const uploads = await api.getUploads();
    const pdf = new jsPDF();
    const pageW = pdf.internal.pageSize.getWidth();
    let y = 15;

    const addSection = (title) => {
      if (y > 250) { pdf.addPage(); y = 15; }
      pdf.setFillColor(37, 99, 235);
      pdf.rect(14, y, pageW - 28, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(title, 18, y + 6);
      pdf.setTextColor(0, 0, 0);
      y += 14;
    };

    // ─── HEADER ───
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(37, 99, 235);
    pdf.text("ReliefLink AI", 14, y);
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Community Intelligence Platform", 60, y);
    y += 6;
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(0.5);
    pdf.line(14, y, pageW - 14, y);
    y += 8;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text("Mission Operations Report", 14, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Generated: ${new Date().toLocaleString()}  |  Gujarat Region  |  Confidential`, 14, y);
    y += 12;

    // ─── EXECUTIVE SUMMARY ───
    addSection("EXECUTIVE SUMMARY");
    const openNeeds = needs.filter(n => n.status !== "resolved");
    const resolvedNeeds = needs.filter(n => n.status === "resolved");
    const urgentNeeds = needs.filter(n => n.priority === "urgent" && n.status !== "resolved");
    const totalVolAssigned = needs.reduce((sum, n) => sum + (n.assigned || 0), 0);
    const availableVols = volunteers.filter(v => v.available).length;

    const summaryData = [
      ["Total Community Needs", String(needs.length)],
      ["Active / Open Needs", String(openNeeds.length)],
      ["Resolved Needs", String(resolvedNeeds.length)],
      ["Resolution Rate", needs.length > 0 ? `${Math.round((resolvedNeeds.length / needs.length) * 100)}%` : "0%"],
      ["Urgent Needs (Active)", String(urgentNeeds.length)],
      ["Total Volunteers", String(volunteers.length)],
      ["Available Volunteers", String(availableVols)],
      ["Total Assignments Made", String(totalVolAssigned)],
      ["Data Uploads Processed", String(uploads.length)],
    ];

    autoTable(pdf, {
      body: summaryData,
      startY: y,
      theme: "plain",
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { halign: "left" } },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: 18 },
    });
    y = pdf.lastAutoTable.finalY + 10;

    // ─── NEEDS TABLE ───
    addSection("COMMUNITY NEEDS REGISTRY");
    autoTable(pdf, {
      head: [["#", "Category", "Location (Region)", "Priority", "Status", "Assigned", "Deadline"]],
      body: needs.map(n => [
        n.id,
        n.category,
        `${n.location} (${n.region})`,
        n.priority.toUpperCase(),
        n.status.toUpperCase(),
        `${n.assigned || 0} / ${n.volunteers}`,
        n.deadline || "N/A"
      ]),
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 10 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = data.cell.raw;
          if (val === "URGENT") data.cell.styles.textColor = [220, 38, 38];
          else if (val === "MEDIUM") data.cell.styles.textColor = [217, 119, 6];
          else data.cell.styles.textColor = [22, 163, 74];
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 10;

    // ─── VOLUNTEER ROSTER ───
    if (y > 230) { pdf.addPage(); y = 15; }
    addSection("VOLUNTEER ROSTER");
    autoTable(pdf, {
      head: [["Name", "Skill", "Region", "Tasks Done", "AI Match %", "Status"]],
      body: volunteers.map(v => [
        v.name,
        v.skill,
        v.region,
        v.tasks,
        `${v.match}%`,
        v.available ? "Available" : "Assigned"
      ]),
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [22, 163, 74], fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 3 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          data.cell.styles.textColor = data.cell.raw === "Available" ? [22, 163, 74] : [100, 116, 139];
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 10;

    // ─── UPLOAD HISTORY ───
    if (uploads.length > 0) {
      if (y > 230) { pdf.addPage(); y = 15; }
      addSection("UPLOAD HISTORY");
      autoTable(pdf, {
        head: [["File", "Village", "Issue", "Records", "Date", "Status"]],
        body: uploads.map(u => [u.file, u.village, u.issue, u.records, u.date, u.status]),
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [124, 58, 237], fontSize: 8, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 3 },
      });
      y = pdf.lastAutoTable.finalY + 10;
    }

    // ─── PRIORITY BREAKDOWN ───
    if (y > 240) { pdf.addPage(); y = 15; }
    addSection("PRIORITY BREAKDOWN");
    const priCounts = { urgent: 0, medium: 0, low: 0 };
    needs.forEach(n => { if (n.status !== "resolved") priCounts[n.priority] = (priCounts[n.priority] || 0) + 1; });
    autoTable(pdf, {
      head: [["Priority Level", "Active Count", "% of Total"]],
      body: [
        ["URGENT", priCounts.urgent, openNeeds.length ? `${Math.round(priCounts.urgent / openNeeds.length * 100)}%` : "0%"],
        ["MEDIUM", priCounts.medium, openNeeds.length ? `${Math.round(priCounts.medium / openNeeds.length * 100)}%` : "0%"],
        ["LOW", priCounts.low, openNeeds.length ? `${Math.round(priCounts.low / openNeeds.length * 100)}%` : "0%"],
      ],
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68], fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 3 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const colors = { URGENT: [220,38,38], MEDIUM: [217,119,6], LOW: [22,163,74] };
          data.cell.styles.textColor = colors[data.cell.raw] || [0,0,0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    y = pdf.lastAutoTable.finalY + 10;

    // ─── FOOTER ───
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`ReliefLink AI  •  Page ${i} of ${totalPages}  •  Confidential`, pageW / 2, pdf.internal.pageSize.getHeight() - 8, { align: "center" });
    }

    pdf.save(`ReliefLink_Report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExportCSV = async () => {
    const needs = await api.getNeeds();
    const headers = ["ID", "Category", "Location", "Region", "Priority", "Status", "Volunteers_Needed", "Assigned", "Deadline"];
    const rows = needs.map(n => [n.id, n.category, `"${n.location}"`, n.region, n.priority, n.status, n.volunteers, n.assigned, n.deadline].join(","));
    const csvRowStr = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvRowStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ReliefLink_report_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if(!chart) return <Spinner/>;
  const impact = intelligence?.impact || {};
  const impactTrend = intelligence?.impactTrend || [];

  return (
    <div style={{padding: isMobile ? '16px 12px' : 32}}>
      <div style={{...css.flex(0,"center","space-between"),marginBottom:24, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 12 : 0}}>
        <div style={{fontSize:13,color:G.t2}}>Reporting Overview · Gujarat Region</div>
        <div style={{...css.flex(10)}}>
          <button style={css.btn("secondary",true)} onClick={handleDownloadPDF}>Download PDF</button>
          <button style={css.btn("primary",true)} onClick={handleExportCSV}>Export CSV</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",gap: isMobile ? 10 : 16,marginBottom:24}}>
        <StatCard label="People Helped"  value={impact.peopleHelped || 0} delta="Live impact counter" accent={G.blue}  icon="🫶"/>
        <StatCard label="Tasks Completed"    value={impact.tasksCompleted || 0}  delta="Real-time completion"  accent={G.green} icon="✅"/>
        <StatCard label="Response Improvement"   value={`${impact.responseTimeImprovementPct || 0}%`} delta="Compared to baseline" accent={G.green} icon="⏱️"/>
        <StatCard label="Distribution Efficiency"      value={`${impact.resourceDistributionEfficiencyPct || 0}%`}  delta="Resource optimization"           accent={G.amber} icon="📤"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap: isMobile ? 14 : 20,marginBottom:24}}>
        <div style={css.card()}>
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${G.border}`}}>
            <div style={{fontSize:14,fontWeight:600,color:G.t1}}>Resolution Rate by Category</div>
          </div>
          <div style={{padding:22}}>
            {chart?.resolution?.map(r=>(
              <ProgressBar key={r.label} label={r.label} value={r.value} max={100}
                color={r.value>=80?G.green:r.value>=50?G.blue:r.value>=40?G.amber:G.red}/>
            ))}
          </div>
        </div>
        <div style={css.card()}>
          <div style={{padding:"16px 22px",borderBottom:`1px solid ${G.border}`}}>
            <div style={{fontSize:14,fontWeight:600,color:G.t1}}>Impact Trend</div>
          </div>
          <div style={{padding:22}}>
            <BarChart data={(impactTrend.length ? impactTrend : chart?.trends || []).map(t=>({label:t.month || t.label,value:t.completed ?? t.value,color:G.blue}))} height={140}/>
          </div>
        </div>
      </div>
      <div style={css.card()}>
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${G.border}`}}>
          <div style={{fontSize:14,fontWeight:600,color:G.t1}}>Volunteer Performance Ranking</div>
        </div>
        <div style={{padding:"8px 0"}}>
          {[{n:"Arjun Kumar",i:"AK",c:"#F59E0B",t:24,r:96,p:1240},{n:"Priya Mehta",i:"PM",c:"#6366F1",t:19,r:89,p:980},{n:"Sonal Raval",i:"SR",c:"#EC4899",t:17,r:94,p:850},{n:"Rohit Desai",i:"RD",c:"#16A34A",t:15,r:80,p:720}].map((v,i)=>(
            <div key={v.n} style={{...css.flex(12,"center"),padding:"12px 22px",borderBottom:i<3?`1px solid ${G.border}`:"none"}}>
              <div style={{fontSize:13,fontWeight:700,color:i<3?"#D97706":G.t3,width:24}}>{i+1}</div>
              <Avatar initials={v.i} color={v.c} size={38}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:G.t1}}>{v.n}</div>
                <div style={{fontSize:11,color:G.t3}}>{v.t} tasks · {v.r}% completion</div>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:G.blue}}>{v.p.toLocaleString()} pts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


