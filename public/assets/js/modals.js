(function initModals(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state;
  const store = App.store;
  const constants = App.constants;
  const format = App.format;
  const render = App.render;
  const tools = App.tools || {};

  function openModal(title, html) {
    global.document.getElementById('modalTitle').textContent = title;
    global.document.getElementById('modalBody').innerHTML = html;
    global.document.getElementById('modalBackdrop').style.display = 'flex';
  }

  function closeModal() {
    global.document.getElementById('modalBackdrop').style.display = 'none';
  }

  function syncMetaThenRefresh(deps) {
    const loadMeta = deps && typeof deps.loadMetaIntoUi === 'function'
      ? deps.loadMetaIntoUi
      : () => Promise.resolve();
    const refresh = deps && typeof deps.refresh === 'function'
      ? deps.refresh
      : null;

    return Promise.resolve()
      .then(() => loadMeta())
      .then(() => (refresh ? refresh() : null));
  }

  function parseOptionalAmount(raw) {
    const text = String(raw || '').replace(/,/g, '').trim();
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) return NaN;
    return Math.trunc(value);
  }

  function renderCategoryModal(deps) {
    const custom = store.loadJson(constants.CATEGORIES_KEY, []);
    const merged = [...new Set([...(state.baseCategories.length ? state.baseCategories : store.defaultCategoryList()), ...custom])];

    const rows = merged.map((name, idx) => {
      const isCustom = custom.includes(name);
      const used = Number((state.usage.categoryUsage || {})[name] || 0);
      const safeName = format.escapeHtml(name);
      return `
        <div class="list-row">
          <div>${safeName}${isCustom ? '<span class="badge user">사용자</span>' : '<span class="badge">기본</span>'}${used ? ` <small class="muted">(${used}건 사용중)</small>` : ''}</div>
          <button class="ghost" ${isCustom ? `data-cat-edit-idx="${idx}"` : 'disabled'}>수정</button>
          <button class="ghost" ${isCustom ? `data-cat-del-idx="${idx}"` : 'disabled'}>삭제</button>
        </div>
      `;
    }).join('');

    openModal('카테고리 관리', `
      <div class="inline" style="margin-bottom:10px;">
        <input id="catNewInput" placeholder="새 카테고리" />
        <button id="catAddBtn">추가</button>
      </div>
      <div id="catList">${rows || '<small>항목 없음</small>'}</div>
    `);

    global.document.getElementById('catAddBtn').onclick = () => {
      const value = global.document.getElementById('catNewInput').value.trim();
      if (!value) return;
      const list = store.loadJson(constants.CATEGORIES_KEY, []);
      if (!list.includes(value) && !state.baseCategories.includes(value)) list.push(value);
      store.saveJson(constants.CATEGORIES_KEY, list);
      syncMetaThenRefresh(deps)
        .then(() => renderCategoryModal(deps))
        .catch(error => global.alert(error.message));
    };

    global.document.getElementById('modalBody').onclick = event => {
      const delIdx = event.target.getAttribute('data-cat-del-idx');
      const editIdx = event.target.getAttribute('data-cat-edit-idx');

      if (delIdx != null) {
        const target = merged[Number(delIdx)];
        if (!target) return;
        const used = Number((state.usage.categoryUsage || {})[target] || 0);
        if (used > 0 && !global.confirm(`"${target}" 카테고리는 기존 거래 ${used}건에서 사용중입니다.\n삭제하면 기존 거래 값은 유지되고 선택 목록에서만 제거됩니다.\n계속할까요?`)) return;
        const list = store.loadJson(constants.CATEGORIES_KEY, []).filter(value => value !== target);
        store.saveJson(constants.CATEGORIES_KEY, list);
        syncMetaThenRefresh(deps)
          .then(() => renderCategoryModal(deps))
          .catch(error => global.alert(error.message));
        return;
      }

      if (editIdx != null) {
        const target = merged[Number(editIdx)];
        if (!target) return;
        const used = Number((state.usage.categoryUsage || {})[target] || 0);
        if (used > 0 && !global.confirm(`"${target}" 카테고리는 기존 거래 ${used}건에서 사용중입니다.\n이름 변경 시 기존 거래 라벨은 자동 변경되지 않습니다.\n계속할까요?`)) return;
        const next = global.prompt('카테고리 이름 수정', target);
        if (!next || !next.trim()) return;
        const list = store.loadJson(constants.CATEGORIES_KEY, []).map(value => (value === target ? next.trim() : value));
        store.saveJson(constants.CATEGORIES_KEY, [...new Set(list)]);
        syncMetaThenRefresh(deps)
          .then(() => renderCategoryModal(deps))
          .catch(error => global.alert(error.message));
      }
    };
  }

  function renderMethodModal(deps) {
    const custom = store.loadJson(constants.METHODS_KEY, []);
    const merged = [...new Set([...(state.baseMethods.length ? state.baseMethods : store.defaultMethodList()), ...custom])];

    const rows = merged.map((name, idx) => {
      const isCustom = custom.includes(name);
      const used = Number((state.usage.paymentMethodUsage || {})[name] || 0);
      const safeName = format.escapeHtml(name);
      return `
        <div class="list-row">
          <div>${safeName}${isCustom ? '<span class="badge user">사용자</span>' : '<span class="badge">기본</span>'}${used ? ` <small class="muted">(${used}건 사용중)</small>` : ''}</div>
          <button class="ghost" ${isCustom ? `data-method-edit-idx="${idx}"` : 'disabled'}>수정</button>
          <button class="ghost" ${isCustom ? `data-method-del-idx="${idx}"` : 'disabled'}>삭제</button>
        </div>
      `;
    }).join('');

    openModal('결제수단 관리', `
      <div class="inline" style="margin-bottom:10px;">
        <input id="methodNewInput" placeholder="새 결제수단" />
        <button id="methodAddBtn">추가</button>
      </div>
      <div id="methodList">${rows || '<small>항목 없음</small>'}</div>
    `);

    global.document.getElementById('methodAddBtn').onclick = () => {
      const value = global.document.getElementById('methodNewInput').value.trim();
      if (!value) return;
      const list = store.loadJson(constants.METHODS_KEY, []);
      if (!list.includes(value) && !state.baseMethods.includes(value)) list.push(value);
      store.saveJson(constants.METHODS_KEY, list);
      syncMetaThenRefresh(deps)
        .then(() => renderMethodModal(deps))
        .catch(error => global.alert(error.message));
    };

    global.document.getElementById('modalBody').onclick = event => {
      const delIdx = event.target.getAttribute('data-method-del-idx');
      const editIdx = event.target.getAttribute('data-method-edit-idx');

      if (delIdx != null) {
        const target = merged[Number(delIdx)];
        if (!target) return;
        const used = Number((state.usage.paymentMethodUsage || {})[target] || 0);
        if (used > 0 && !global.confirm(`"${target}" 결제수단은 기존 거래 ${used}건에서 사용중입니다.\n삭제하면 기존 거래 값은 유지되고 선택 목록에서만 제거됩니다.\n계속할까요?`)) return;
        const list = store.loadJson(constants.METHODS_KEY, []).filter(value => value !== target);
        store.saveJson(constants.METHODS_KEY, list);
        syncMetaThenRefresh(deps)
          .then(() => renderMethodModal(deps))
          .catch(error => global.alert(error.message));
        return;
      }

      if (editIdx != null) {
        const target = merged[Number(editIdx)];
        if (!target) return;
        const used = Number((state.usage.paymentMethodUsage || {})[target] || 0);
        if (used > 0 && !global.confirm(`"${target}" 결제수단은 기존 거래 ${used}건에서 사용중입니다.\n이름 변경 시 기존 거래 라벨은 자동 변경되지 않습니다.\n계속할까요?`)) return;
        const next = global.prompt('결제수단 이름 수정', target);
        if (!next || !next.trim()) return;
        const list = store.loadJson(constants.METHODS_KEY, []).map(value => (value === target ? next.trim() : value));
        store.saveJson(constants.METHODS_KEY, [...new Set(list)]);
        syncMetaThenRefresh(deps)
          .then(() => renderMethodModal(deps))
          .catch(error => global.alert(error.message));
      }
    };
  }

  function renderBalanceModal(deps = {}) {
    const accounts = store.getBalanceAccounts();
    const snapshots = store.getBalanceSnapshots();
    const editingAccount = accounts.find(account => account.id === deps.editingAccountId) || null;
    const editingSnapshot = editingAccount ? (snapshots[editingAccount.id] || {}) : {};

    const rows = accounts.map(account => {
      const snapshot = snapshots[account.id] || {};
      const baseline = Number.isFinite(Number(snapshot.baselineBalance))
        ? format.money(snapshot.baselineBalance, account.currency)
        : '-';
      const actual = Number.isFinite(Number(snapshot.currentActualBalance))
        ? format.money(snapshot.currentActualBalance, account.currency)
        : '-';
      const dateText = snapshot.baselineDate ? format.formatKoreanDate(snapshot.baselineDate) : '-';
      return `
        <div class="entity-row">
          <div>
            <div class="card-title">${format.escapeHtml(account.name)}</div>
            <div class="card-meta">${format.escapeHtml(account.currency)} · source=${format.escapeHtml(account.source)} · 기준일 ${format.escapeHtml(dateText)}</div>
            <div class="card-meta">기준 잔액 ${format.escapeHtml(baseline)} · 실제 현재 잔액 ${format.escapeHtml(actual)}</div>
          </div>
          <div class="card-actions">
            <button class="ghost mini" type="button" data-acc-edit="${account.id}">수정</button>
            <button class="ghost mini" type="button" data-acc-del="${account.id}">삭제</button>
          </div>
        </div>
      `;
    }).join('');

    openModal('잔고 관리', `
      <div class="modal-grid" style="margin-bottom:12px;">
        <input id="accEditId" type="hidden" value="${editingAccount ? format.escapeHtml(editingAccount.id) : ''}" />
        <div>
          <label class="muted">이름</label>
          <input id="accNameInput" placeholder="예: 생활비 통장" value="${editingAccount ? format.escapeHtml(editingAccount.name) : ''}" />
        </div>
        <div>
          <label class="muted">통화</label>
          <select id="accCurrencyInput">
            <option value="JPY" ${editingAccount?.currency === 'JPY' ? 'selected' : ''}>JPY (¥)</option>
            <option value="KRW" ${editingAccount?.currency === 'KRW' ? 'selected' : ''}>KRW (₩)</option>
            <option value="USD" ${editingAccount?.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
          </select>
        </div>
        <div>
          <label class="muted">연결 규칙</label>
          <select id="accSourceInput">
            <option value="sumitomo" ${editingAccount?.source === 'sumitomo' ? 'selected' : ''}>스미토모</option>
            <option value="rakuten" ${editingAccount?.source === 'rakuten' ? 'selected' : ''}>라쿠텐</option>
            <option value="cash" ${editingAccount?.source === 'cash' ? 'selected' : ''}>현금</option>
            <option value="none" ${editingAccount?.source === 'none' ? 'selected' : ''}>미연동</option>
          </select>
        </div>
        <div>
          <label class="muted">기준일</label>
          <input id="accBaselineDateInput" type="date" value="${editingSnapshot.baselineDate ? format.escapeHtml(editingSnapshot.baselineDate) : ''}" />
        </div>
        <div>
          <label class="muted">기준 잔액</label>
          <input id="accBaselineBalanceInput" inputmode="numeric" placeholder="예: 120000" value="${editingSnapshot.baselineBalance != null ? format.escapeHtml(String(editingSnapshot.baselineBalance)) : ''}" />
        </div>
        <div>
          <label class="muted">실제 현재 잔액</label>
          <input id="accCurrentActualInput" inputmode="numeric" placeholder="예: 118700" value="${editingSnapshot.currentActualBalance != null ? format.escapeHtml(String(editingSnapshot.currentActualBalance)) : ''}" />
        </div>
      </div>
      <div class="inline" style="justify-content:flex-end; margin-bottom:12px;">
        <button id="accSaveBtn">${editingAccount ? '수정 저장' : '계좌 추가'}</button>
      </div>
      <div class="hint">기준일 이후 거래를 합산해 기대 잔액을 계산합니다. 스냅샷은 브라우저 로컬에 저장됩니다.</div>
      <div class="stack-list" style="margin-top:12px;">${rows || '<small>항목 없음</small>'}</div>
    `);

    global.document.getElementById('accSaveBtn').onclick = async () => {
      const id = global.document.getElementById('accEditId').value.trim() || `acc_${Date.now()}`;
      const name = global.document.getElementById('accNameInput').value.trim();
      const currency = global.document.getElementById('accCurrencyInput').value;
      const source = global.document.getElementById('accSourceInput').value;
      const baselineDate = global.document.getElementById('accBaselineDateInput').value.trim();
      const baselineBalance = parseOptionalAmount(global.document.getElementById('accBaselineBalanceInput').value);
      const currentActualBalance = parseOptionalAmount(global.document.getElementById('accCurrentActualInput').value);

      if (!name) {
        global.alert('계좌 이름을 입력해주세요.');
        return;
      }
      if (Number.isNaN(baselineBalance) || Number.isNaN(currentActualBalance)) {
        global.alert('잔액은 0 이상의 숫자로 입력해주세요.');
        return;
      }

      const nextAccounts = store.getBalanceAccounts().filter(account => account.id !== id);
      nextAccounts.push({ id, name, currency, source });
      const nextSnapshots = { ...store.getBalanceSnapshots() };
      nextSnapshots[id] = {
        baselineDate,
        baselineBalance,
        currentActualBalance,
      };

      store.setBalanceAccounts(nextAccounts);
      store.setBalanceSnapshots(nextSnapshots);
      render.applyBalanceHeaders();
      if (typeof deps.onSaved === 'function') await deps.onSaved();
      renderBalanceModal({ ...deps, editingAccountId: null });
    };

    global.document.getElementById('modalBody').onclick = async event => {
      const editId = event.target.getAttribute('data-acc-edit');
      const delId = event.target.getAttribute('data-acc-del');
      if (editId) {
        renderBalanceModal({ ...deps, editingAccountId: editId });
        return;
      }
      if (!delId) return;

      const nextAccounts = store.getBalanceAccounts().filter(account => account.id !== delId);
      const nextSnapshots = { ...store.getBalanceSnapshots() };
      delete nextSnapshots[delId];
      store.setBalanceAccounts(nextAccounts);
      store.setBalanceSnapshots(nextSnapshots);
      render.applyBalanceHeaders();
      if (typeof deps.onSaved === 'function') await deps.onSaved();
      renderBalanceModal(deps);
    };
  }

  function renderTemplateModal(deps = {}) {
    const categories = deps.categories || state.baseCategories || store.defaultCategoryList();
    const methods = deps.methods || state.baseMethods || store.defaultMethodList();
    const templates = store.getRecurringTemplates().map(template => tools.normalizeTemplate(template));
    const editing = templates.find(template => template.id === deps.editingTemplateId) || null;

    const rows = templates
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map(template => `
        <div class="entity-row">
          <div>
            <div class="card-title">${format.escapeHtml(template.name)}</div>
            <div class="card-meta">${format.escapeHtml(template.category)} · ${format.escapeHtml(template.paymentMethod)} · ${format.escapeHtml(format.money(template.amount, template.currency))}</div>
            <div class="card-meta">${template.recurrence === 'monthly' ? `매월 ${template.billingDay}일 자동 제안` : '수동 퀵 템플릿'}</div>
          </div>
          <div class="card-actions">
            <button class="ghost mini" type="button" data-template-edit="${template.id}">수정</button>
            <button class="ghost mini" type="button" data-template-del="${template.id}">삭제</button>
          </div>
        </div>
      `).join('');

    openModal('반복 거래 / 퀵 템플릿', `
      <div class="modal-grid" style="margin-bottom:12px;">
        <input id="templateEditId" type="hidden" value="${editing ? format.escapeHtml(editing.id) : ''}" />
        <div>
          <label class="muted">템플릿 이름</label>
          <input id="templateNameInput" placeholder="예: 월세" value="${editing ? format.escapeHtml(editing.name) : ''}" />
        </div>
        <div>
          <label class="muted">내용</label>
          <input id="templateItemInput" placeholder="예: 월세 이체" value="${editing ? format.escapeHtml(editing.item) : ''}" />
        </div>
        <div>
          <label class="muted">카테고리</label>
          <select id="templateCategoryInput">
            ${categories.map(category => `<option value="${format.escapeHtml(category)}" ${editing?.category === category ? 'selected' : ''}>${format.escapeHtml(category)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="muted">결제수단</label>
          <select id="templateMethodInput">
            ${methods.map(method => `<option value="${format.escapeHtml(method)}" ${editing?.paymentMethod === method ? 'selected' : ''}>${format.escapeHtml(method)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="muted">거래구분</label>
          <select id="templateTxTypeInput">
            <option value="expense" ${editing?.txType !== 'income' ? 'selected' : ''}>지출</option>
            <option value="income" ${editing?.txType === 'income' ? 'selected' : ''}>수입</option>
          </select>
        </div>
        <div>
          <label class="muted">금액</label>
          <input id="templateAmountInput" inputmode="numeric" placeholder="예: 60000" value="${editing ? format.escapeHtml(String(editing.amount)) : ''}" />
        </div>
        <div>
          <label class="muted">통화</label>
          <select id="templateCurrencyInput">
            <option value="JPY" ${editing?.currency === 'JPY' ? 'selected' : ''}>JPY</option>
            <option value="KRW" ${editing?.currency === 'KRW' ? 'selected' : ''}>KRW</option>
            <option value="USD" ${editing?.currency === 'USD' ? 'selected' : ''}>USD</option>
          </select>
        </div>
        <div>
          <label class="muted">반복</label>
          <select id="templateRecurrenceInput">
            <option value="none" ${editing?.recurrence !== 'monthly' ? 'selected' : ''}>수동</option>
            <option value="monthly" ${editing?.recurrence === 'monthly' ? 'selected' : ''}>매월</option>
          </select>
        </div>
        <div>
          <label class="muted">반영일(1-28)</label>
          <input id="templateBillingDayInput" inputmode="numeric" placeholder="1" value="${editing ? format.escapeHtml(String(editing.billingDay)) : '1'}" />
        </div>
        <div style="grid-column:1 / -1;">
          <label class="muted">메모</label>
          <input id="templateMemoInput" placeholder="메모 (선택)" value="${editing ? format.escapeHtml(editing.memo) : ''}" />
        </div>
      </div>
      <div class="inline" style="justify-content:flex-end; margin-bottom:12px;">
        <button id="templateSaveBtn">${editing ? '템플릿 수정' : '템플릿 추가'}</button>
      </div>
      <div class="stack-list">${rows || '<small>등록된 템플릿이 없습니다.</small>'}</div>
    `);

    global.document.getElementById('templateSaveBtn').onclick = async () => {
      const editId = global.document.getElementById('templateEditId').value.trim();
      const amount = parseOptionalAmount(global.document.getElementById('templateAmountInput').value);
      if (!Number.isFinite(amount) || amount <= 0) {
        global.alert('템플릿 금액은 1 이상의 숫자로 입력해주세요.');
        return;
      }

      const normalized = tools.normalizeTemplate({
        id: editId || `tpl_${Date.now()}`,
        name: global.document.getElementById('templateNameInput').value.trim(),
        item: global.document.getElementById('templateItemInput').value.trim(),
        category: global.document.getElementById('templateCategoryInput').value,
        paymentMethod: global.document.getElementById('templateMethodInput').value,
        txType: global.document.getElementById('templateTxTypeInput').value,
        amount,
        currency: global.document.getElementById('templateCurrencyInput').value,
        recurrence: global.document.getElementById('templateRecurrenceInput').value,
        billingDay: global.document.getElementById('templateBillingDayInput').value,
        memo: global.document.getElementById('templateMemoInput').value.trim(),
        lastAppliedMonth: editing?.lastAppliedMonth || '',
      });

      const nextTemplates = store.getRecurringTemplates()
        .filter(template => String(template.id) !== normalized.id)
        .concat(normalized)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      store.setRecurringTemplates(nextTemplates);
      if (typeof deps.onSaved === 'function') await deps.onSaved();
      renderTemplateModal({ ...deps, editingTemplateId: null });
    };

    global.document.getElementById('modalBody').onclick = async event => {
      const editId = event.target.getAttribute('data-template-edit');
      const delId = event.target.getAttribute('data-template-del');
      if (editId) {
        renderTemplateModal({ ...deps, editingTemplateId: editId });
        return;
      }
      if (!delId) return;
      const nextTemplates = store.getRecurringTemplates().filter(template => String(template.id) !== delId);
      store.setRecurringTemplates(nextTemplates);
      if (typeof deps.onSaved === 'function') await deps.onSaved();
      renderTemplateModal(deps);
    };
  }

  function renderImportPreview(preview) {
    if (!preview) return '<div class="hint">CSV 텍스트를 붙여넣고 미리보기를 실행하세요.</div>';
    const errorHtml = (preview.errors || []).length > 0
      ? `<div class="warn" style="margin-bottom:8px;">${preview.errors.slice(0, 5).map(format.escapeHtml).join('<br />')}</div>`
      : '<div class="ok" style="margin-bottom:8px;">파싱 오류 없음</div>';
    const rows = (preview.entries || []).slice(0, 8).map(entry => `
      <tr>
        <td>${format.escapeHtml(entry.date)}</td>
        <td>${format.escapeHtml(entry.item)}</td>
        <td>${format.escapeHtml(entry.category)}</td>
        <td>${format.escapeHtml(entry.paymentMethod)}</td>
        <td>${format.escapeHtml(format.money(entry.amount, entry.currency))}</td>
      </tr>
    `).join('');
    return `
      <div class="hint" style="margin-bottom:6px;">총 ${preview.entries.length}건 미리보기 · 오류 ${preview.errors.length}건</div>
      ${errorHtml}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>내용</th>
              <th>카테고리</th>
              <th>결제수단</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">미리보기 항목 없음</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function renderCsvImportModal(deps = {}) {
    let preview = state.importPreview;

    openModal('CSV 가져오기', `
      <div class="modal-grid" style="margin-bottom:12px;">
        <div style="grid-column:1 / -1;">
          <label class="muted">CSV 파일</label>
          <input id="csvFileInput" type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" />
        </div>
        <div style="grid-column:1 / -1;">
          <label class="muted">CSV 내용</label>
          <textarea id="csvTextInput" rows="10" placeholder="헤더 포함 CSV를 붙여넣으세요."></textarea>
        </div>
      </div>
      <div class="inline" style="justify-content:flex-end; margin-bottom:12px;">
        <button id="csvPreviewBtn" class="ghost">미리보기</button>
        <button id="csvImportBtn">가져오기 실행</button>
      </div>
      <div id="csvPreviewBox">${renderImportPreview(preview)}</div>
    `);

    function parsePreview() {
      const text = global.document.getElementById('csvTextInput').value;
      preview = tools.mapCsvRowsToTransactions(text, deps.defaults || {});
      state.importPreview = preview;
      global.document.getElementById('csvPreviewBox').innerHTML = renderImportPreview(preview);
      return preview;
    }

    global.document.getElementById('csvFileInput').addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const text = await file.text();
      global.document.getElementById('csvTextInput').value = text;
      parsePreview();
    });

    global.document.getElementById('csvPreviewBtn').onclick = () => {
      parsePreview();
    };

    global.document.getElementById('csvImportBtn').onclick = async () => {
      const current = preview || parsePreview();
      if (!current.entries || current.entries.length === 0) {
        global.alert('가져올 거래가 없습니다.');
        return;
      }
      if (typeof deps.onImport !== 'function') return;
      await deps.onImport(current.entries);
      state.importPreview = null;
      closeModal();
    };
  }

  function renderCategoryBudgetModal(deps = {}) {
    const categories = deps.categories || state.baseCategories || store.defaultCategoryList();
    const current = { ...(state.categoryBudgets || {}) };
    const editingCategory = deps.editingCategory || '';

    const rows = Object.entries(current)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, amount]) => `
        <div class="entity-row">
          <div>
            <div class="card-title">${format.escapeHtml(category)}</div>
            <div class="card-meta">월 예산 ${format.escapeHtml(format.yen(amount))}</div>
          </div>
          <div class="card-actions">
            <button class="ghost mini" type="button" data-budget-edit="${format.escapeHtml(category)}">수정</button>
            <button class="ghost mini" type="button" data-budget-del="${format.escapeHtml(category)}">삭제</button>
          </div>
        </div>
      `).join('');

    openModal('카테고리 예산 관리', `
      <div class="modal-grid" style="margin-bottom:12px;">
        <div>
          <label class="muted">카테고리</label>
          <select id="budgetCategoryInput">
            ${categories.map(category => `<option value="${format.escapeHtml(category)}" ${editingCategory === category ? 'selected' : ''}>${format.escapeHtml(category)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="muted">월 예산 (JPY)</label>
          <input id="budgetAmountInput" inputmode="numeric" placeholder="예: 20000" value="${editingCategory && current[editingCategory] ? format.escapeHtml(String(current[editingCategory])) : ''}" />
        </div>
      </div>
      <div class="inline" style="justify-content:flex-end; margin-bottom:12px;">
        <button id="budgetSaveBtn">예산 저장</button>
      </div>
      <div class="stack-list">${rows || '<small>등록된 예산이 없습니다.</small>'}</div>
    `);

    global.document.getElementById('budgetSaveBtn').onclick = async () => {
      const category = global.document.getElementById('budgetCategoryInput').value.trim();
      const amount = parseOptionalAmount(global.document.getElementById('budgetAmountInput').value);
      if (!category) {
        global.alert('카테고리를 선택해주세요.');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        global.alert('예산은 1 이상의 숫자로 입력해주세요.');
        return;
      }
      const next = { ...(state.categoryBudgets || {}) };
      next[category] = amount;
      if (typeof deps.onSave === 'function') await deps.onSave(next);
      renderCategoryBudgetModal(deps);
    };

    global.document.getElementById('modalBody').onclick = async event => {
      const edit = event.target.getAttribute('data-budget-edit');
      const del = event.target.getAttribute('data-budget-del');
      if (edit) {
        renderCategoryBudgetModal({ ...deps, editingCategory: edit });
        return;
      }
      if (!del) return;
      const next = { ...(state.categoryBudgets || {}) };
      delete next[del];
      if (typeof deps.onSave === 'function') await deps.onSave(next);
      renderCategoryBudgetModal(deps);
    };
  }

  App.modals = {
    openModal,
    closeModal,
    renderCategoryModal,
    renderMethodModal,
    renderBalanceModal,
    renderTemplateModal,
    renderCsvImportModal,
    renderCategoryBudgetModal,
  };
})(typeof window !== 'undefined' ? window : globalThis);
