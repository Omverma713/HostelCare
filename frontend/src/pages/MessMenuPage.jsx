import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import {
  DAYS_ORDER,
  MEAL_SLOTS,
  DEFAULT_MESS_DATA,
  OFFICIAL_MESS_TIMINGS,
  getKolkataTime,
  getMealStatusForDay,
} from '../constants/messMenuData';
import {
  scheduleWeeklyMealReminders,
  areMealRemindersEnabled,
  setMealRemindersEnabled,
  triggerTestMealNotification,
} from '../services/messNotificationService';
import './MessMenuPage.css';

// Staff roles authorized to manage mess timetable
const STAFF_MESS_ROLES = ['superadmin', 'caretaker', 'warden', 'superintendent', 'chiefHostelWarden'];

export default function MessMenuPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Current Kolkata Time & Day
  const [kolkataTime, setKolkataTime] = useState(() => getKolkataTime());
  const [selectedDay, setSelectedDay] = useState(() => getKolkataTime().dayOfWeek);

  // Manual holiday override: null (use official status), true (force holiday), false (force working)
  const [manualHolidayOverride, setManualHolidayOverride] = useState(null);

  // Menu Data State & 3-state Data Freshness Tracking
  const [menuData, setMenuData] = useState(DEFAULT_MESS_DATA);
  const [loading, setLoading] = useState(false);
  const [dataFreshness, setDataFreshness] = useState({
    source: 'live', // 'live' | 'cache' | 'default'
    cachedAt: null,
  });

  // View state: 'timeline' | 'matrix'
  const [viewMode, setViewMode] = useState('timeline');

  // Veg filter: 'all' | 'veg'
  const [vegOnly, setVegOnly] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(() => areMealRemindersEnabled());
  const [liveNotificationConfig, setLiveNotificationConfig] = useState(null);

  // Fetch public automated notification schedule
  useEffect(() => {
    api.getPublicMessNotificationSchedule()
      .then((res) => {
        if (res?.success && res.config) {
          setLiveNotificationConfig(res.config);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch public mess notification schedule:', err);
      });
  }, []);

  // Staff Management Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editDay, setEditDay] = useState('monday');
  const [editSlot, setEditSlot] = useState('lunch');
  const [editItemsText, setEditItemsText] = useState('');
  const [editTiming, setEditTiming] = useState('');
  const [editGuidelinesText, setEditGuidelinesText] = useState('');
  const [editOptions, setEditOptions] = useState([]);
  const [publishing, setPublishing] = useState(false);

  const isStaff = useMemo(() => {
    return isAuthenticated && user && STAFF_MESS_ROLES.includes(user.role);
  }, [isAuthenticated, user]);

  // If navigated with ?edit=true, automatically open the staff management modal
  useEffect(() => {
    if (location.search.includes('edit=true') && isStaff) {
      setIsManageModalOpen(true);
    }
  }, [location.search, isStaff]);

  // Keep Asia/Kolkata clock updated every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setKolkataTime(getKolkataTime());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fetch published menu from server
  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMessMenu();
      if (res?.menu) {
        setMenuData(res.menu);
        setDataFreshness({
          source: res.source || (res.fromCache ? 'cache' : res.isOfflineFallback ? 'default' : 'live'),
          cachedAt: res.cachedAt || null,
        });
      }
    } catch (err) {
      console.warn('Using bundled mess schedule fallback:', err.message);
      setDataFreshness({ source: 'default', cachedAt: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Auto-schedule meal start notifications whenever menuData is loaded or changed
  useEffect(() => {
    scheduleWeeklyMealReminders(menuData).catch(() => {});
  }, [menuData]);

  const handleToggleAlerts = async () => {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    const success = await setMealRemindersEnabled(next, menuData);
    if (success) {
      triggerToast(
        'success',
        next
          ? '🔔 Auto Meal Alerts Active! You will receive notifications at each meal start time.'
          : '🔕 Meal start notifications paused.'
      );
    }
  };

  const handleTestNotification = async () => {
    try {
      await triggerTestMealNotification(mealStatus?.activeSlot || 'breakfast');
      triggerToast('info', '🔔 Sample meal notification sent! Check your notification drawer.');
    } catch (err) {
      triggerToast('error', err.message || 'Notification permission required.');
    }
  };

  // Determine official holiday status of selected day
  const isSelectedDayOfficialHoliday = useMemo(() => {
    if (selectedDay === 'sunday') return true;
    if (selectedDay === kolkataTime.dayOfWeek && kolkataTime.isHoliday) return true;
    return false;
  }, [selectedDay, kolkataTime]);

  // Effective timing: Sunday is always Sunday timing; otherwise respect explicit manual toggle
  const effectiveIsHoliday = useMemo(() => {
    if (selectedDay === 'sunday') return true;
    if (manualHolidayOverride !== null) return manualHolidayOverride;
    return isSelectedDayOfficialHoliday;
  }, [selectedDay, manualHolidayOverride, isSelectedDayOfficialHoliday]);

  // Current Day Meals
  const currentDaySchedule = useMemo(() => {
    const schedule = menuData.schedule || DEFAULT_MESS_DATA.schedule;
    return schedule[selectedDay] || schedule.monday;
  }, [menuData, selectedDay]);

  // Meal Status for active day: strictly suppressed if not currently today
  const mealStatus = useMemo(() => {
    const isToday = selectedDay === kolkataTime.dayOfWeek;
    if (!isToday) {
      return { activeSlot: null, nextSlot: null };
    }
    return getMealStatusForDay(currentDaySchedule.meals, kolkataTime, effectiveIsHoliday);
  }, [currentDaySchedule, selectedDay, kolkataTime, effectiveIsHoliday]);

  // Change selected day and reset manual overrides so days default to official schedules
  const handleSelectDay = (dayKey) => {
    setSelectedDay(dayKey);
    setManualHolidayOverride(null);
  };

  const handleToggleHoliday = () => {
    if (selectedDay === 'sunday') return;
    setManualHolidayOverride((prev) => {
      const current = prev !== null ? prev : isSelectedDayOfficialHoliday;
      return !current;
    });
  };

  // Navigation handlers for Prev / Next day
  const handlePrevDay = () => {
    const currentIndex = DAYS_ORDER.findIndex((d) => d.key === selectedDay);
    const prevIndex = (currentIndex - 1 + DAYS_ORDER.length) % DAYS_ORDER.length;
    handleSelectDay(DAYS_ORDER[prevIndex].key);
  };

  const handleNextDay = () => {
    const currentIndex = DAYS_ORDER.findIndex((d) => d.key === selectedDay);
    const nextIndex = (currentIndex + 1) % DAYS_ORDER.length;
    handleSelectDay(DAYS_ORDER[nextIndex].key);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isAuthenticated ? '/' : '/login');
    }
  };

  // Populate Edit Modal Fields when day/slot changes
  useEffect(() => {
    if (!isManageModalOpen) return;
    const schedule = menuData.schedule || DEFAULT_MESS_DATA.schedule;
    const dayData = schedule[editDay] || schedule.monday;
    const meal = dayData.meals[editSlot];
    if (meal) {
      setEditItemsText((meal.items || []).join('\n'));
      setEditTiming(meal.timing || '');
      setEditOptions(meal.options || []);
    }
    setEditGuidelinesText((menuData.guidelines || []).join('\n'));
  }, [isManageModalOpen, editDay, editSlot, menuData]);

  // Handle Staff Menu Publishing
  const handlePublishChanges = async () => {
    setPublishing(true);
    try {
      const scheduleCopy = JSON.parse(JSON.stringify(menuData.schedule || DEFAULT_MESS_DATA.schedule));
      const targetDay = scheduleCopy[editDay] || scheduleCopy.monday;
      const targetMeal = targetDay.meals[editSlot];

      if (targetMeal) {
        targetMeal.items = editItemsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        targetMeal.timing = editTiming.trim() || targetMeal.timing;
        targetMeal.options = editOptions;
      }

      const updatedGuidelines = editGuidelinesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: menuData.title || DEFAULT_MESS_DATA.title,
        season: menuData.season || DEFAULT_MESS_DATA.season,
        hostel: menuData.hostel || DEFAULT_MESS_DATA.hostel,
        schedule: scheduleCopy,
        guidelines: updatedGuidelines,
      };

      const res = await api.updateMessMenu(payload);
      if (res.success && res.menu) {
        setMenuData(res.menu);
        triggerToast('success', 'Mess menu published successfully!');
        setIsManageModalOpen(false);
      } else {
        triggerToast('error', res.message || 'Failed to publish mess menu.');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Error updating mess menu.');
    } finally {
      setPublishing(false);
    }
  };

  // Handle Staff Menu Reset
  const handleResetToDefault = async () => {
    if (!window.confirm('Are you sure you want to restore the official verified 2026 timetable? All custom modifications will be reset.')) {
      return;
    }
    setPublishing(true);
    try {
      const res = await api.resetMessMenu();
      if (res.success && res.menu) {
        setMenuData(res.menu);
        triggerToast('info', 'Restored official 2026 timetable.');
        setIsManageModalOpen(false);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to restore default schedule.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={`mess-menu-root ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
      <div className="mess-ambient-bg" />

      <main className="mess-container">
        {/* Top Navigation */}
        <div className="mess-top-nav">
          <button
            type="button"
            className="mess-back-btn"
            onClick={handleBack}
            id="btn-mess-back"
          >
            ← {isAuthenticated ? 'Dashboard' : 'Sign In'}
          </button>

          <div className="mess-top-actions">
            {/* View Mode Switcher */}
            <button
              type="button"
              className={`mess-chip-toggle ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
              id="btn-view-timeline"
            >
              📅 Daily Cards
            </button>
            <button
              type="button"
              className={`mess-chip-toggle ${viewMode === 'matrix' ? 'active' : ''}`}
              onClick={() => setViewMode('matrix')}
              id="btn-view-weekly"
            >
              📋 Weekly Table
            </button>

            {/* Holiday Schedule Toggle */}
            <button
              type="button"
              className={`mess-chip-toggle ${effectiveIsHoliday ? 'active' : ''}`}
              onClick={handleToggleHoliday}
              id="btn-toggle-holiday"
              disabled={selectedDay === 'sunday'}
              title={
                selectedDay === 'sunday'
                  ? 'Sunday is officially governed by Sunday timings'
                  : effectiveIsHoliday
                  ? 'Switch back to official working day schedule'
                  : 'Preview or apply institute holiday timings'
              }
            >
              🎉 {selectedDay === 'sunday' ? 'Sunday Timings' : effectiveIsHoliday ? 'Holiday Timings (Active)' : 'Working Days'}
            </button>

            {/* Veg Only Toggle */}
            <button
              type="button"
              className={`mess-chip-toggle ${vegOnly ? 'active' : ''}`}
              onClick={() => setVegOnly(!vegOnly)}
              id="btn-toggle-veg"
              title="Filter pure vegetarian selections"
            >
              🟢 {vegOnly ? 'Veg Only' : 'All Diets'}
            </button>

            {/* Quick Dark/Light Theme Toggle */}
            <button
              type="button"
              className="mess-chip-toggle"
              onClick={toggleTheme}
              id="btn-mess-theme-toggle"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle display theme"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>

            {/* Autonomous Meal Start Reminders Toggle */}
            <button
              type="button"
              className={`mess-chip-toggle ${alertsEnabled ? 'active' : ''}`}
              onClick={handleToggleAlerts}
              id="btn-toggle-meal-alerts"
              title={alertsEnabled ? 'Auto notifications active for every meal start timing' : 'Enable auto notifications for meal timings'}
              aria-label="Toggle meal notifications"
            >
              {alertsEnabled ? '🔔 Alerts ON' : '🔕 Alerts OFF'}
            </button>

            {/* Test Meal Notification */}
            <button
              type="button"
              className="mess-chip-toggle"
              onClick={handleTestNotification}
              id="btn-test-meal-alert"
              title="Test real-time meal notification"
              aria-label="Test meal notification"
            >
              ⚡ Test Alert
            </button>

            {/* Quick jump to Automated Mess Notifications Panel */}
            <button
              type="button"
              className="mess-chip-toggle"
              onClick={() => {
                const el = document.getElementById('mess-autonotice-options');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              id="btn-scroll-mess-options"
              title="View automated push notification options and timetable"
              aria-label="View automated notification options"
            >
              🍱 Auto-Alerts Info
            </button>

            {/* Staff Management Action */}
            {isStaff && (
              <button
                type="button"
                className="mess-manage-btn"
                onClick={() => setIsManageModalOpen(true)}
                id="btn-staff-manage-menu"
              >
                ⚙️ Manage Menu
              </button>
            )}
          </div>
        </div>

        {/* Hero Header */}
        <header className="mess-header-deck">
          <div className="mess-season-badge">
            ❄️ {menuData.season || 'Rainy / Winter Season 2026'}
          </div>
          <h1 className="mess-hero-title">
            {menuData.hostel || "Boys' Hostel"} Mess Menu
          </h1>
          <p className="mess-hero-subtitle">
            <span>Official Dining Schedule & Meal Timings</span>
            <span className="mess-live-clock-pill">
              🕒 IST: {kolkataTime.formattedTime}
            </span>
            {dataFreshness.source === 'live' && (
              <span style={{ fontSize: '0.75rem', color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                🟢 Verified Campus Schedule (v{menuData.version || 1})
              </span>
            )}
            {dataFreshness.source === 'cache' && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                💾 Offline Cache ({dataFreshness.cachedAt ? new Date(dataFreshness.cachedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : 'Local'})
              </span>
            )}
            {dataFreshness.source === 'default' && (
              <span style={{ fontSize: '0.75rem', color: '#4b5563', background: '#f3f4f6', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                ⚡ Bundled Official Timetable (Verified 2026 Baseline)
              </span>
            )}
          </p>
        </header>

        {/* Day Selector Strip */}
        <nav className="mess-days-nav-wrapper" aria-label="Days of the week">
          <div className="mess-days-strip">
            {DAYS_ORDER.map((d) => {
              const isToday = d.key === kolkataTime.dayOfWeek;
              const isSelected = d.key === selectedDay;
              return (
                <button
                  key={d.key}
                  type="button"
                  className={`mess-day-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectDay(d.key)}
                  id={`pill-day-${d.key}`}
                >
                  {isToday && <span className="today-indicator-dot" title="Today" />}
                  <span className="day-pill-short">{d.short}</span>
                  <span className="day-pill-label">{d.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Day Stepper & Schedule Status Bar */}
        <div className="mess-stepper-row">
          <button
            type="button"
            className="mess-step-btn"
            onClick={handlePrevDay}
            id="btn-prev-day"
            aria-label="Previous Day"
          >
            ← Previous
          </button>

          <div className="mess-current-day-center">
            <div className="mess-day-title-row">
              <span className="mess-day-title-text">{currentDaySchedule.label}</span>
              {selectedDay === kolkataTime.dayOfWeek && (
                <span className="mess-badge-today">TODAY</span>
              )}
            </div>

            <div className="mess-schedule-tag-wrap">
              {selectedDay === 'sunday' ? (
                <span className="mess-schedule-tag sunday">
                  🎉 Sunday Schedule (Official)
                </span>
              ) : selectedDay === kolkataTime.dayOfWeek && kolkataTime.isHoliday ? (
                <span className="mess-schedule-tag holiday">
                  🎉 Gazetted Campus Holiday (Official)
                </span>
              ) : manualHolidayOverride === true ? (
                <span className="mess-schedule-tag override">
                  ⚠️ Holiday Preview Timings Active
                </span>
              ) : (
                <span className="mess-schedule-tag working">
                  💼 Working Day Schedule (Official)
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="mess-step-btn"
            onClick={handleNextDay}
            id="btn-next-day"
            aria-label="Next Day"
          >
            Next →
          </button>
        </div>

        {/* VIEW 1: Timeline Card View */}
        {viewMode === 'timeline' && (
          <div className="mess-timeline">
            {MEAL_SLOTS.map((slot) => {
              const meal = currentDaySchedule.meals[slot.key];
              if (!meal) return null;

              const isNowServing = mealStatus.activeSlot?.key === slot.key;
              const isUpcoming = mealStatus.nextSlot?.key === slot.key;

              // Dietary Filter Logic: if vegOnly, only show veg options/items
              const filteredOptions = vegOnly
                ? (meal.options || []).filter((opt) => opt.type === 'veg')
                : (meal.options || []);

              // Official revised timing display
              const displayedTiming = effectiveIsHoliday ? slot.holidayTiming : slot.workingTiming;

              return (
                <article
                  key={slot.key}
                  className={`mess-meal-card ${isNowServing ? 'is-now-serving' : ''}`}
                  id={`meal-card-${slot.key}`}
                >
                  <div className="mess-meal-header">
                    <div className="meal-slot-identity">
                      <div className="meal-slot-icon-box">{slot.icon}</div>
                      <div className="meal-title-block">
                        <h3>{meal.name || slot.label}</h3>
                        <span className="meal-time-tag">
                          🕒 {displayedTiming}
                        </span>
                      </div>
                    </div>

                    {isNowServing && (
                      <span className="meal-status-pill now-serving">
                        ● NOW SERVING
                      </span>
                    )}

                    {!isNowServing && isUpcoming && (
                      <span className="meal-status-pill upcoming">
                        ⏳ UPCOMING NEXT
                      </span>
                    )}

                    {isStaff && (
                      <button
                        type="button"
                        className="mess-card-edit-btn"
                        onClick={() => {
                          setEditDay(selectedDay);
                          setEditSlot(slot.key);
                          setIsManageModalOpen(true);
                        }}
                        title={`Edit ${slot.label} dishes for ${selectedDay}`}
                      >
                        ✏️ Edit Dishes
                      </button>
                    )}
                  </div>

                  {/* Standard Included Items */}
                  <div className="mess-items-group">
                    <div className="mess-section-eyebrow">Main Items & Accompaniments</div>
                    <div className="mess-items-wrap">
                      {(meal.items || []).map((item, idx) => (
                        <span
                          key={idx}
                          className={`food-chip ${vegOnly && meal.dietary === 'veg' ? 'highlight-veg' : ''}`}
                        >
                          <span
                            className={`diet-dot ${meal.dietary === 'nonveg' ? 'nonveg' : meal.dietary === 'egg' ? 'egg' : 'veg'}`}
                          />
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Choice & Alternatives (e.g. Fish Kalia vs Besan Curry, Chicken Biryani vs Veg Biryani) */}
                  {filteredOptions.length > 0 && (
                    <div className="mess-items-group" style={{ marginTop: '0.75rem' }}>
                      <div className="mess-section-eyebrow">
                        Choice & Rotational Alternatives
                      </div>
                      <div className="meal-options-grid">
                        {filteredOptions.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`meal-option-card option-${opt.type}`}
                          >
                            <div className="meal-option-details">
                              <div className="meal-option-name">
                                {opt.name}
                              </div>
                              {opt.portion && (
                                <div className="meal-option-portion">
                                  Portion: {opt.portion}
                                </div>
                              )}
                            </div>
                            <span className={`option-badge ${opt.type}`}>
                              {opt.type === 'veg' ? '🟢 VEG' : opt.type === 'egg' ? '🟡 EGG' : '🔴 NON-VEG'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {meal.notes && (
                    <div className="meal-special-note">
                      ℹ️ {meal.notes}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* VIEW 2: Weekly Matrix / Table View */}
        {viewMode === 'matrix' && (
          <div className="mess-matrix-wrapper">
            <table className="mess-matrix-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>
                    <div>Breakfast</div>
                    <div style={{ fontSize: '0.675rem', opacity: 0.9, fontWeight: 500 }}>
                      W: 07:00–09:15 | Sun: 08:00–10:00
                    </div>
                  </th>
                  <th>
                    <div>Lunch</div>
                    <div style={{ fontSize: '0.675rem', opacity: 0.9, fontWeight: 500 }}>
                      12:30 PM – 02:30 PM
                    </div>
                  </th>
                  <th>
                    <div>Snacks</div>
                    <div style={{ fontSize: '0.675rem', opacity: 0.9, fontWeight: 500 }}>
                      W: 05:45–07:30 | Sun: 05:30–07:00
                    </div>
                  </th>
                  <th>
                    <div>Dinner</div>
                    <div style={{ fontSize: '0.675rem', opacity: 0.9, fontWeight: 500 }}>
                      08:30 PM – 10:00 PM
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS_ORDER.map((d) => {
                  const schedule = menuData.schedule || DEFAULT_MESS_DATA.schedule;
                  const dayData = schedule[d.key] || schedule.monday;
                  const isCurrentDay = d.key === kolkataTime.dayOfWeek;

                  return (
                    <tr
                      key={d.key}
                      className={isCurrentDay ? 'current-day-row' : ''}
                    >
                      <td className="matrix-day-cell">
                        {d.label}
                        {isCurrentDay && (
                          <div style={{ fontSize: '0.65rem', color: '#047857', fontWeight: 800 }}>
                            ● TODAY
                          </div>
                        )}
                        <div style={{ fontSize: '0.65rem', color: d.key === 'sunday' ? '#b45309' : '#64748b' }}>
                          {d.key === 'sunday' ? 'Holiday Timing' : 'Working Timing'}
                        </div>
                      </td>

                      {/* Breakfast */}
                      <td>
                        <div>{(dayData.meals.breakfast.items || []).join(', ')}</div>
                      </td>

                      {/* Lunch */}
                      <td>
                        <div>{(dayData.meals.lunch.items || []).join(', ')}</div>
                        {(dayData.meals.lunch.options || []).length > 0 && (
                          <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>
                            Choice: {dayData.meals.lunch.options.map((o) => o.name).join(' OR ')}
                          </div>
                        )}
                      </td>

                      {/* Snacks */}
                      <td>
                        <div>{(dayData.meals.snacks.items || []).join(', ')}</div>
                      </td>

                      {/* Dinner */}
                      <td>
                        <div>{(dayData.meals.dinner.items || []).join(', ')}</div>
                        {(dayData.meals.dinner.options || []).length > 0 && (
                          <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>
                            Choice: {dayData.meals.dinner.options.map((o) => o.name).join(' OR ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Automated Mess Notification Options Section */}
        {(() => {
          const scheduleKey = effectiveIsHoliday ? 'sundayAndHolidays' : 'workingDays';
          const currentConfig = liveNotificationConfig?.[scheduleKey] || {};
          const bTime = currentConfig.breakfast?.timing || (effectiveIsHoliday ? '08:00 AM – 10:00 AM' : '07:00 AM – 09:15 AM');
          const lTime = currentConfig.lunch?.timing || '12:30 PM – 02:30 PM';
          const sTime = currentConfig.snacks?.timing || (effectiveIsHoliday ? '05:30 PM – 07:00 PM' : '05:45 PM – 07:30 PM');
          const dTime = currentConfig.dinner?.timing || '08:30 PM – 10:00 PM';

          return (
            <section className="mess-autonotice-panel" id="mess-autonotice-options">
              <div className="autonotice-header">
                <div className="autonotice-title-wrap">
                  <span className="autonotice-icon">🍱</span>
                  <div>
                    <h2 className="autonotice-title">Automated Mess Push Notifications</h2>
                    <p className="autonotice-subtitle">
                      Receive instant meal alerts at each dining start time whether this website is open, running in the background, or your mobile screen is locked. Pulls daily food items directly from the campus schedule.
                    </p>
                  </div>
                </div>
                <div className={`autonotice-status-badge ${alertsEnabled ? '' : 'muted'}`}>
                  {alertsEnabled ? '🔔 ACTIVE & SCHEDULED' : '🔕 REMINDERS PAUSED'}
                </div>
              </div>

              <div className="autonotice-timings-grid">
                <div className="autonotice-slot-item">
                  <span className="slot-emoji">🍳</span>
                  <div className="slot-info">
                    <span className="slot-name">Breakfast</span>
                    <span className="slot-time">{bTime}</span>
                  </div>
                </div>
                <div className="autonotice-slot-item">
                  <span className="slot-emoji">🍛</span>
                  <div className="slot-info">
                    <span className="slot-name">Lunch</span>
                    <span className="slot-time">{lTime}</span>
                  </div>
                </div>
                <div className="autonotice-slot-item">
                  <span className="slot-emoji">☕</span>
                  <div className="slot-info">
                    <span className="slot-name">Evening Snacks</span>
                    <span className="slot-time">{sTime}</span>
                  </div>
                </div>
                <div className="autonotice-slot-item">
                  <span className="slot-emoji">🍲</span>
                  <div className="slot-info">
                    <span className="slot-name">Dinner</span>
                    <span className="slot-time">{dTime}</span>
                  </div>
                </div>
              </div>

              <div className="autonotice-actions-row">
                <button
                  type="button"
                  className={`autonotice-action-btn ${alertsEnabled ? 'btn-active' : 'btn-primary'}`}
                  onClick={handleToggleAlerts}
                  id="btn-panel-toggle-alerts"
                >
                  {alertsEnabled ? '🔕 Mute Meal Reminders' : '🔔 Turn On Auto Reminders'}
                </button>

                <button
                  type="button"
                  className="autonotice-action-btn btn-secondary"
                  onClick={handleTestNotification}
                  id="btn-panel-test-alert"
                >
                  ⚡ Send Test Alert Now
                </button>

                {isStaff && (
                  <button
                    type="button"
                    className="autonotice-action-btn btn-admin"
                    onClick={() => navigate('/superadmin?tab=messalerts')}
                    id="btn-panel-admin-schedule"
                  >
                    ⚙️ Configure Push Timings & Broadcast
                  </button>
                )}
              </div>
            </section>
          );
        })()}

        {/* Official Mess Guidelines & Dietary Standards */}
        <section className="mess-guidelines-card">
          <div className="guidelines-header">
            <span>📜</span>
            <span>Official Mess Guidelines & Notice Ref: ITER Campus-1 (08/10/2026)</span>
          </div>
          <ul className="guidelines-list">
            {(menuData.guidelines || DEFAULT_MESS_DATA.guidelines).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>

        {/* Staff Management Modal */}
        {isManageModalOpen && isStaff && (
          <div className="mess-modal-overlay">
            <div className="mess-modal-box">
              <div className="mess-modal-header">
                <h2>Manage Mess Schedule (Staff Console)</h2>
                <button
                  type="button"
                  className="mess-modal-close-btn"
                  onClick={() => setIsManageModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="mess-form-group">
                  <label className="mess-form-label">Select Day</label>
                  <select
                    className="mess-form-select"
                    value={editDay}
                    onChange={(e) => setEditDay(e.target.value)}
                  >
                    {DAYS_ORDER.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mess-form-group">
                  <label className="mess-form-label">Select Meal Slot</label>
                  <select
                    className="mess-form-select"
                    value={editSlot}
                    onChange={(e) => setEditSlot(e.target.value)}
                  >
                    {MEAL_SLOTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label} ({s.workingTiming})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mess-form-group">
                <label className="mess-form-label">Meal Timing (Display String)</label>
                <input
                  type="text"
                  className="mess-form-input"
                  value={editTiming}
                  onChange={(e) => setEditTiming(e.target.value)}
                  placeholder="e.g. 12:30 PM – 02:30 PM"
                />
              </div>

              <div className="mess-form-group">
                <label className="mess-form-label">
                  Food Items (One item per line)
                </label>
                <textarea
                  className="mess-form-textarea"
                  value={editItemsText}
                  onChange={(e) => setEditItemsText(e.target.value)}
                  placeholder="Rice (Usuna / Arua)&#10;Roti&#10;Dal"
                />
              </div>

              <div className="mess-form-group">
                <label className="mess-form-label">
                  Guidelines & Dietary Notes (One per line)
                </label>
                <textarea
                  className="mess-form-textarea"
                  value={editGuidelinesText}
                  onChange={(e) => setEditGuidelinesText(e.target.value)}
                />
              </div>

              <div className="mess-modal-actions">
                <button
                  type="button"
                  className="btn-mess-reset"
                  onClick={handleResetToDefault}
                  disabled={publishing}
                >
                  ↺ Restore 2026 Default
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="mess-step-btn"
                    onClick={() => setIsManageModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-mess-publish"
                    onClick={handlePublishChanges}
                    disabled={publishing}
                  >
                    {publishing ? 'Publishing...' : 'Publish to Campus'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
